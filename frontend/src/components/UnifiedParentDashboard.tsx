import { Screen } from '../App';
import { BRAND } from '@/design-system/tokens';
import { AppTopBar } from './AppTopBar';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Plus, Brain, GraduationCap, LogOut, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Shield, Clock, CheckCircle, AlertCircle, User, BookOpen, TrendingUp, TrendingDown, Minus, BarChart3, Lock, Unlock, UserPlus, Play, Eye, Lightbulb, Target, Home, Users, FileText, Award, Activity, RefreshCw, PieChart, Sparkles, Heart, MessageSquare, Flame, AlertTriangle, Zap, BarChart2, Gauge, Timer, Compass, Star, HelpCircle, RotateCcw, CalendarDays, Send, School, Building2, Laptop, Bell, Fingerprint, Download, Video, Share2, Search, Layers } from "lucide-react";
import { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { fetchDashboard, createChild, updateConsent, startSupervisedTest, fetchUser, type DashboardData } from "@/lib/api";

import type { Child, User as UserType } from "@shared/schema";

import { SideMenu } from "./SideMenu";
import { RoleSwitcher } from "./RoleSwitcher";
import { ParentEnterpriseHub } from "./ParentEnterpriseHub";
import { ParentEducationPlanner } from "./ParentEducationPlanner";
import { AIPoweredReports } from "./AIPoweredReports";
import ParentPlacementReadinessCard from "./career/ParentPlacementReadinessCard";

import { LBIProductPage } from "./LBIProductPage";
import { ExamReadinessPage } from "./ExamReadinessPage";
import { MetryxAIAssistantPage } from "./MetryxAIAssistantPage";
import { TestCreationManager } from "./TestCreationManager";
import { ParentMentorServices, BookedSession } from "./ParentMentorServices";
import { LBIEducationCorrelation } from "./LBIEducationCorrelation";
import NotificationCenter from '@/components/NotificationCenter';
import { HelpPanel } from './HelpPanel';
import { QuickTour } from './QuickTour';
import { shouldShowTour } from '@/lib/tourUtils';
import { GlobalSearch } from './GlobalSearch';
import { MilestoneCelebration, detectMilestones } from './MilestoneCelebration';
import { SiblingComparison } from './SiblingComparison';
import { WeeklyInsightDigest, buildDigestData } from './WeeklyInsightDigest';
import { PeerCohortBenchmark } from './PeerCohortBenchmark';
import { ParentChildGoals } from './ParentChildGoals';
import { SubjectLBIReport } from './SubjectLBIReport';
import { ShareLBIReport } from './ShareLBIReport';
import LearningCollabTab from './LearningCollabTab';
import { ParentPeriodicSurvey } from './ParentPeriodicSurvey';
import { UnifiedGrowthScorecard } from './UnifiedGrowthScorecard';
import { CredentialCard } from './CredentialCard';
import { SmartParentBanner, type SmartAlert } from './SmartParentBanner';
import { QuickCheckIn } from './QuickCheckIn';

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('metryx_token');
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> ?? {}),
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('metryx_token');
    localStorage.removeItem('metryx_user');
    window.dispatchEvent(new CustomEvent('metryx:logout'));
  }
  return res;
}

interface Props {
  onNavigate: (screen: Screen, data?: { childId?: string; lbiTab?: string }) => void;
  selectedChildId?: string | null;
  onChildChange?: (childId: string) => void;
}

const GRADES = [
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6',
  'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'
];

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];
const LANGUAGES = ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi', 'Other'];
const BOARDS = ['CBSE', 'ICSE', 'State Board', 'IB', 'IGCSE', 'NIOS', 'Other'];
const STATES = ['Andhra Pradesh', 'Karnataka', 'Kerala', 'Maharashtra', 'Tamil Nadu', 'Telangana', 'Delhi', 'Gujarat', 'Rajasthan', 'Uttar Pradesh', 'West Bengal', 'Other'];
const STUDY_HOURS = ['Less than 1 hour', '1-2 hours', '2-3 hours', '3-4 hours', 'More than 4 hours'];
const SUBJECTS = ['Mathematics', 'Science', 'English', 'Social Studies', 'Hindi', 'Computer Science', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'Economics', 'Other'];
const LEARNING_STYLES = ['Visual Learner', 'Auditory Learner', 'Reading/Writing', 'Kinesthetic', 'Mixed/Multimodal'];
const CAREER_INTERESTS = ['Engineering', 'Medicine', 'Arts & Design', 'Business', 'Science & Research', 'Law', 'Civil Services', 'Sports', 'Music/Arts', 'Technology', 'Undecided', 'Other'];
const RELATIONSHIPS = ['Mother', 'Father', 'Guardian', 'Grandparent', 'Other'];
const SCHOOL_TYPES = ['Government', 'Private', 'International', 'Home School', 'Other'];
const MEDIUM_OF_INSTRUCTION = ['English', 'Hindi', 'Regional Language', 'Bilingual'];

// ── AlertTicker ─────────────────────────────────────────────────────────────
type AlertItem = {
  type: string; category: string; icon: React.ReactNode;
  title: string; desc: string; action?: () => void; actionLabel?: string;
};
const TICKER_MS = 4000;
function AlertTicker({ alerts }: { alerts: AlertItem[] }) {
  const [idx, setIdx]         = useState(0);
  const [visible, setVisible] = useState(true);
  const [paused, setPaused]   = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const go = (next: number) => {
    setVisible(false);
    setTimeout(() => { setIdx(next); setVisible(true); }, 260);
  };

  useEffect(() => {
    if (alerts.length <= 1 || paused) return;
    timer.current = setInterval(() => go((idx + 1) % alerts.length), TICKER_MS);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [idx, alerts.length, paused]);

  if (!alerts.length) return (
    <div className="flex items-center gap-2 py-1.5">
      <CheckCircle size={13} style={{ color: BRAND.accent }} />
      <span className="text-xs font-semibold" style={{ color: BRAND.accent }}>All clear — no pending actions.</span>
    </div>
  );

  const alert = alerts[idx];

  const gradMap: Record<string, string> = {
    action:  BRAND.navy,
    warning: BRAND.accent,
    info:    BRAND.navy,
    success: BRAND.accent,
    report:  BRAND.navy,
  };
  const glowMap: Record<string, string> = {
    action:  'rgba(11,60,93,0.35)',
    warning: 'rgba(78,205,196,0.35)',
    info:    'rgba(11,60,93,0.4)',
    success: 'rgba(78,205,196,0.35)',
    report:  'rgba(11,60,93,0.3)',
  };
  const dotMap: Record<string, string> = {
    action: '#7a93c4', warning: BRAND.accent, info: '#7a93c4', success: BRAND.accent, report: '#7a93c4',
  };
  const accentMap: Record<string, string> = {
    action: BRAND.navy, warning: BRAND.accent, info: BRAND.navy, success: BRAND.accent, report: BRAND.navy,
  };

  const grad   = gradMap[alert.type]   || gradMap.info;
  const glow   = glowMap[alert.type]   || glowMap.info;
  const dot    = dotMap[alert.type]    || dotMap.info;
  const accent = accentMap[alert.type] || accentMap.info;

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <style>{`
        @keyframes mtrx-bell-shake {
          0%,100%{ transform:rotate(0); }
          15%    { transform:rotate(14deg); }
          30%    { transform:rotate(-12deg); }
          45%    { transform:rotate(10deg); }
          60%    { transform:rotate(-8deg); }
          75%    { transform:rotate(6deg); }
        }
        @keyframes mtrx-glow-pulse {
          0%,100%{ box-shadow: 0 6px 20px ${glow}; }
          50%    { box-shadow: 0 10px 32px ${glow}; }
        }
        @keyframes mtrx-icon-pop {
          0%  { transform: scale(0.7); opacity: 0; }
          60% { transform: scale(1.15); }
          100%{ transform: scale(1);   opacity: 1; }
        }
      `}</style>

      {/* Step dots + nav */}
      <div className="flex items-center gap-1 mb-2">
        {alerts.map((_, i) => (
          <button key={i} onClick={() => go(i)} style={{
            width: i === idx ? 16 : 6, height: 6, borderRadius: 999,
            background: i === idx ? dot : '#CBD5E1',
            border: 'none', padding: 0, cursor: 'pointer',
            transition: 'width 0.3s ease, background 0.3s ease',
          }} />
        ))}
        <button onClick={() => go((idx - 1 + alerts.length) % alerts.length)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: BRAND.slate, fontSize: 15, lineHeight: 1, padding: '0 1px', marginLeft: 4 }}>‹</button>
        <button onClick={() => go((idx + 1) % alerts.length)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: BRAND.slate, fontSize: 15, lineHeight: 1, padding: '0 1px' }}>›</button>
      </div>

      {/* ── Card ── */}
      <div
        key={`card-${idx}`}
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.26s ease, transform 0.26s ease',
        }}
      >
        <div className="flex items-start gap-3">
          {/* Icon bubble */}
          <div
            key={`icon-${idx}`}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: glow.replace(/[\d.]+\)$/, '0.1)'),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              animation: 'mtrx-icon-pop 0.4s ease-out forwards',
            }}
          >
            {alert.icon}
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-normal leading-relaxed">
              <span style={{ color: BRAND.navy }}>{alert.title} — </span>
              <span style={{ color: BRAND.navy }}>{alert.desc}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
// ────────────────────────────────────────────────────────────────────────────

export function UnifiedParentDashboard({ onNavigate, selectedChildId: externalChildId, onChildChange }: Props) {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [userData, setUserData] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionPackages, setSubscriptionPackages] = useState<Array<{id: string; category: string; productName: string; studentSegment: string; domainsCovered: string[]; reportType: string; price: number; isRecommended: boolean;}>>([]);
  const [childSubscriptions, setChildSubscriptions] = useState<any[]>([]);
  const [isAddChildOpen, setIsAddChildOpen] = useState(false);
  const [isConsentDialogOpen, setIsConsentDialogOpen] = useState(false);
  const [consentAction, setConsentAction] = useState<'grant' | 'revoke'>('grant');
  const [expandedExamId, setExpandedExamId] = useState<string | null>(null);
  const [isSupervisedTestOpen, setIsSupervisedTestOpen] = useState(false);
  const [supervisedExamId, setSupervisedExamId] = useState<string | null>(null);
  const [activeMenuItem, setActiveMenuItem] = useState('dashboard');
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [selectedPieSegment, setSelectedPieSegment] = useState<string | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  
  const [newChildName, setNewChildName] = useState('');
  const [newChildAge, setNewChildAge] = useState('');
  const [newChildGrade, setNewChildGrade] = useState('');
  const [newChildSchool, setNewChildSchool] = useState('');
  const [newChildGender, setNewChildGender] = useState('');
  const [newChildDOB, setNewChildDOB] = useState('');
  const [newChildBloodGroup, setNewChildBloodGroup] = useState('');
  const [newChildLanguage, setNewChildLanguage] = useState('');
  const [newChildBoard, setNewChildBoard] = useState('');
  const [newChildCity, setNewChildCity] = useState('');
  const [newChildState, setNewChildState] = useState('');
  const [newChildSpecialNeeds, setNewChildSpecialNeeds] = useState('');
  const [newChildStudyHours, setNewChildStudyHours] = useState('');
  const [newChildFavoriteSubjects, setNewChildFavoriteSubjects] = useState<string[]>([]);
  const [newChildWeakSubjects, setNewChildWeakSubjects] = useState<string[]>([]);
  const [newChildLearningStyle, setNewChildLearningStyle] = useState('');
  const [newChildCareerInterest, setNewChildCareerInterest] = useState('');
  const [newChildRelationship, setNewChildRelationship] = useState('');
  const [newChildSchoolType, setNewChildSchoolType] = useState('');
  const [newChildMedium, setNewChildMedium] = useState('');
  const [newChildExtracurricular, setNewChildExtracurricular] = useState('');
  const [newChildEmergencyContact, setNewChildEmergencyContact] = useState('');
  const [newChildMedicalConditions, setNewChildMedicalConditions] = useState('');
  const [addChildStep, setAddChildStep] = useState(1);
  const [learningSection, setLearningSection] = useState<'academics' | 'tests' | 'wellness'>('academics');
  const [newlyRegisteredChildId, setNewlyRegisteredChildId] = useState<string | null>(null);
  const [firstGoalTitle, setFirstGoalTitle] = useState('');
  const [firstGoalDescription, setFirstGoalDescription] = useState('');
  const [firstGoalCategory, setFirstGoalCategory] = useState<'academic' | 'behaviour' | 'wellness' | 'career'>('academic');
  const [firstGoalTargetDate, setFirstGoalTargetDate] = useState('');

  const [showSetBoardModal, setShowSetBoardModal] = useState(false);
  const [pendingBoard, setPendingBoard] = useState('');
  const [savingBoard, setSavingBoard] = useState(false);
  const [pendingGrade, setPendingGrade] = useState('');
  const [savingGrade, setSavingGrade] = useState(false);

  
  // Consent states for Add Child
  const [consentDataCollection, setConsentDataCollection] = useState(false);
  const [consentBehavioral, setConsentBehavioral] = useState(false);
  const [consentProgress, setConsentProgress] = useState(false);
  const [consentDPDP, setConsentDPDP] = useState(false);
  const [acknowledgeDevelopment, setAcknowledgeDevelopment] = useState(false);
  const [isAddingChild, setIsAddingChild] = useState(false);
  
  // Assessment browser states
  const [availableAssessments, setAvailableAssessments] = useState<any[]>([]);
  const [isAssessmentBrowserOpen, setIsAssessmentBrowserOpen] = useState(false);
  const [selectedAssessmentGrade, setSelectedAssessmentGrade] = useState<string>('');
  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [assigningAssessment, setAssigningAssessment] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Study tasks for LBI correlation
  const [studyTasks, setStudyTasks] = useState<any[]>([]);
  
  // Supervised test monitoring state
  const [isMonitoringOpen, setIsMonitoringOpen] = useState(false);
  const [monitoringExam, setMonitoringExam] = useState<any>(null);
  const [monitoringQuestions, setMonitoringQuestions] = useState<any[]>([]);
  const [loadingMonitoring, setLoadingMonitoring] = useState(false);
  const [studentAnswers, setStudentAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [examResult, setExamResult] = useState<{ score: number; total: number; percentage: number } | null>(null);
  const [submittingExam, setSubmittingExam] = useState(false);

  const closeMonitoringDialog = () => {
    setIsMonitoringOpen(false);
    setMonitoringExam(null);
    setMonitoringQuestions([]);
    setStudentAnswers({});
    setCurrentQuestionIndex(0);
    setExamSubmitted(false);
    setExamResult(null);
  };
  
  const [pendingMilestones, setPendingMilestones] = useState<any[]>([]);
  const [showMilestones, setShowMilestones] = useState(false);
  const [showShareLBIReport, setShowShareLBIReport] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showPendingPopup, setShowPendingPopup] = useState(false);
  const [showAssignmentsPopup, setShowAssignmentsPopup] = useState(false);
  const [showPackagesPopup, setShowPackagesPopup] = useState(false);
  const [newChildCredentials, setNewChildCredentials] = useState<{ childName: string; username: string; password: string } | null>(null);

  const { toast } = useToast();

  // Exam Readiness child picker dialog
  const [isExamReadyPickerOpen, setIsExamReadyPickerOpen] = useState(false);
  const [examReadySelectedChildId, setExamReadySelectedChildId] = useState<string | null>(null);
  const [examTakenBy, setExamTakenBy] = useState<'child' | 'parent'>('child');
  const [bookedMentorSessions, setBookedMentorSessions] = useState<BookedSession[]>(() => {
    try {
      const stored = localStorage.getItem('metryx_booked_mentor_sessions');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  const handleExamReadyStart = () => {
    if (!dashboardData?.children?.length) {
      toast({ title: 'No children added', description: 'Please add a child profile first.', variant: 'destructive' });
      return;
    }
    setExamReadySelectedChildId(selectedChild?.id ?? dashboardData.children[0]?.id ?? null);
    setExamTakenBy('child');
    setIsExamReadyPickerOpen(true);
  };

  const handleExamReadyConfirm = () => {
    const child = dashboardData?.children?.find(c => c.id === examReadySelectedChildId);
    if (!child) return;
    setIsExamReadyPickerOpen(false);
    onNavigate('exam-ready-checkout', {
      childId: child.id,
      childName: child.name,
      board: (child as any)?.board ?? undefined,
      grade: (child as any)?.grade ?? undefined,
      takenBy: examTakenBy,
    });
  };

  const handleMenuSelect = (itemId: string) => {
    setActiveMenuItem(itemId);
    const scrollToTabs = () => {
      setTimeout(() => {
        tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    };
    
    if (itemId === 'dashboard') {
      setActiveTab('overview');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (itemId === 'education') {
      setActiveTab('education');
      scrollToTabs();
    } else if (itemId === 'lbi') {
      setActiveTab('lbi');
      scrollToTabs();
    } else if (itemId === 'tests-planner') {
      setActiveTab('education');
      setLearningSection('tests');
      scrollToTabs();
    } else if (itemId === 'exam-trends') {
      setActiveTab('exam-trends');
      scrollToTabs();
    } else if (itemId === 'my-packages') {
      setActiveTab('my-packages');
      scrollToTabs();
    } else if (itemId === 'lbi-product') {
      setActiveTab('lbi-product');
    } else if (itemId === 'exam-ready') {
      setActiveTab('exam-ready');
    } else if (itemId === 'ai-powered-reports') {
      setActiveTab('ai-powered-reports');
    } else if (itemId === 'metryxai-assistant') {
      setActiveTab('metryxai-assistant');
    } else if (itemId === 'enterprise-hub') {
      setActiveTab('education');
      setLearningSection('wellness');
      scrollToTabs();
    } else if (itemId === 'mentor-services') {
      setActiveTab('mentor-services');
      scrollToTabs();
    } else if (itemId === 'learning-collab') {
      setActiveTab('learning-collab');
      scrollToTabs();
    }
  };

  useEffect(() => {
    loadDashboard();
    // Fetch subscription packages
    authFetch('/api/subscription-packages')
      .then(res => res.ok ? res.json() : [])
      .then(data => setSubscriptionPackages(data))
      .catch(() => setSubscriptionPackages([]));
    // Fetch child subscriptions (assigned packages)
    authFetch('/api/my-subscriptions')
      .then(res => res.ok ? res.json() : [])
      .then(data => setChildSubscriptions(data))
      .catch(() => setChildSubscriptions([]));
  }, []);

  // Load assessments when browser opens — always use child's grade automatically
  useEffect(() => {
    if (isAssessmentBrowserOpen) {
      fetchAvailableAssessments(selectedChild?.grade || '');
    }
  }, [isAssessmentBrowserOpen]);

  // Persist booked mentor sessions to localStorage so they survive page refresh
  useEffect(() => {
    try { localStorage.setItem('metryx_booked_mentor_sessions', JSON.stringify(bookedMentorSessions)); } catch {}
  }, [bookedMentorSessions]);

  // Load study tasks when child is selected
  useEffect(() => {
    if (dashboardData?.selectedChild?.id) {
      fetchStudyTasks(dashboardData.selectedChild.id);
    }
  }, [dashboardData?.selectedChild?.id]);

  const fetchStudyTasks = async (childId: string) => {
    try {
      const response = await authFetch(`/api/children/${childId}/study-tasks`);
      if (response.ok) {
        const data = await response.json();
        setStudyTasks(data);
      }
    } catch (error) {
      console.error('Failed to fetch study tasks:', error);
    }
  };

  const loadDashboard = async (childId?: string) => {
    try {
      setLoading(true);
      const [data, user] = await Promise.all([
        fetchDashboard(childId),
        fetchUser()
      ]);
      setDashboardData(data);
      setUserData(user);
      // Keep App.tsx selectedChildId in sync so other screens (parent-lbi etc.) always inherit the right child
      if (data?.selectedChild?.id && onChildChange) {
        onChildChange(data.selectedChild.id);
      }
      // Auto-start tour for first-time visitors
      if (shouldShowTour()) setShowTour(true);
      // Detect and show milestones
      if (data?.selectedChild) {
        const completedExs = (data.exams || []).filter((e: any) => e.status === 'completed');
        const milestones = detectMilestones(data.selectedChild.id, completedExs, data.lbiData);
        if (milestones.length) { setPendingMilestones(milestones); setShowMilestones(true); }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load dashboard",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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
    onNavigate(targetScreen);
  };

  const fetchAvailableAssessments = async (grade?: string) => {
    setLoadingAssessments(true);
    try {
      const params = new URLSearchParams();
      if (grade) params.set('grade', grade);
      if (selectedChild?.id) params.set('childId', selectedChild.id);
      const url = `/api/assessment-templates?${params.toString()}`;
      const response = await authFetch(url);
      if (response.ok) {
        const data = await response.json();
        setAvailableAssessments(data);
      }
    } catch (error) {
      console.error('Failed to fetch assessments:', error);
    } finally {
      setLoadingAssessments(false);
    }
  };

  const assignAssessmentToChild = async (templateId: string) => {
    if (!selectedChild) return;
    setAssigningAssessment(templateId);
    try {
      const response = await authFetch(`/api/assessment-templates/${templateId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId: selectedChild.id })
      });
      
      if (response.ok) {
        toast({
          title: "Assessment Assigned",
          description: `The assessment has been assigned to ${selectedChild.name}`,
        });
        loadDashboard(selectedChild.id);
        fetchAvailableAssessments(selectedChild.grade || '');
      } else {
        const error = await response.json();
        throw new Error(error.message);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to assign assessment",
        variant: "destructive",
      });
    } finally {
      setAssigningAssessment(null);
    }
  };

  const fetchExamQuestionsForMonitoring = async (examId: string) => {
    setLoadingMonitoring(true);
    setStudentAnswers({});
    setCurrentQuestionIndex(0);
    setExamSubmitted(false);
    setExamResult(null);
    try {
      const response = await authFetch(`/api/parent/exams/${examId}/questions`);
      if (response.ok) {
        const data = await response.json();
        setMonitoringExam(data.exam);
        setMonitoringQuestions(data.questions);
        setIsMonitoringOpen(true);
      } else {
        const error = await response.json();
        throw new Error(error.message);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load exam questions",
        variant: "destructive",
      });
    } finally {
      setLoadingMonitoring(false);
    }
  };

  const submitSupervisedExam = async () => {
    if (!monitoringExam || !selectedChild) return;
    setSubmittingExam(true);
    try {
      const responses = monitoringQuestions.map(q => ({
        questionId: q.id,
        selectedOption: studentAnswers[q.id] || null
      }));
      
      const response = await authFetch(`/api/parent/exams/${monitoringExam.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId: selectedChild.id, responses })
      });
      
      if (response.ok) {
        const result = await response.json();
        setExamResult({
          score: result.score,
          total: result.totalMarks,
          percentage: result.percentage
        });
        setExamSubmitted(true);
        toast({
          title: "Exam Submitted",
          description: `Score: ${result.score}/${result.totalMarks} (${result.percentage}%)`,
        });
        loadDashboard(selectedChild.id);
      } else {
        const error = await response.json();
        throw new Error(error.message);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit exam",
        variant: "destructive",
      });
    } finally {
      setSubmittingExam(false);
    }
  };

  const resetAddChildForm = () => {
    setNewChildName('');
    setNewChildAge('');
    setNewChildGrade('');
    setNewChildSchool('');
    setNewChildGender('');
    setNewChildDOB('');
    setNewChildBloodGroup('');
    setNewChildLanguage('');
    setNewChildBoard('');
    setNewChildCity('');
    setNewChildState('');
    setNewChildSpecialNeeds('');
    setNewChildStudyHours('');
    setNewChildFavoriteSubjects([]);
    setNewChildWeakSubjects([]);
    setNewChildLearningStyle('');
    setNewChildCareerInterest('');
    setNewChildRelationship('');
    setNewChildSchoolType('');
    setNewChildMedium('');
    setNewChildExtracurricular('');
    setNewChildEmergencyContact('');
    setNewChildMedicalConditions('');
    setAddChildStep(1);
    setNewlyRegisteredChildId(null);
    setFirstGoalTitle('');
    setFirstGoalDescription('');
    setFirstGoalCategory('academic');
    setFirstGoalTargetDate('');
    setConsentDataCollection(false);
    setConsentBehavioral(false);
    setConsentProgress(false);
    setConsentDPDP(false);
    setAcknowledgeDevelopment(false);
    setIsAddingChild(false);
  };

  const studyHoursToNumber = (text: string): number | undefined => {
    const map: Record<string, number> = {
      'Less than 1 hour': 0.5,
      '1-2 hours': 1.5,
      '2-3 hours': 2.5,
      '3-4 hours': 3.5,
      'More than 4 hours': 5,
    };
    return map[text] ?? undefined;
  };

  const handleSetBoard = async () => {
    if (!pendingBoard || !selectedChild?.id) return;
    setSavingBoard(true);
    try {
      const token = localStorage.getItem('metryx_token');
      const res = await fetch(`/api/children/${selectedChild.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ board: pendingBoard }),
      });
      if (!res.ok) throw new Error('Failed to save board');
      toast({ title: 'Board updated', description: `${selectedChild.name}'s board set to ${pendingBoard}` });
      setShowSetBoardModal(false);
      setPendingBoard('');
      loadDashboard(selectedChild.id);
    } catch {
      toast({ title: 'Error', description: 'Could not save board. Please try again.', variant: 'destructive' });
    } finally {
      setSavingBoard(false);
    }
  };

  const handleSetGrade = async (grade: string) => {
    if (!grade || !selectedChild?.id) return;
    setSavingGrade(true);
    try {
      const token = localStorage.getItem('metryx_token');
      const res = await fetch(`/api/children/${selectedChild.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ grade }),
      });
      if (!res.ok) throw new Error('Failed to save grade');
      toast({ title: 'Grade saved', description: `${selectedChild.name}'s grade set to ${grade}` });
      setPendingGrade('');
      await loadDashboard(selectedChild.id);
      fetchAvailableAssessments(grade);
    } catch {
      toast({ title: 'Error', description: 'Could not save grade. Please try again.', variant: 'destructive' });
    } finally {
      setSavingGrade(false);
    }
  };

  const handleAddChild = async () => {
    if (!newChildName || !newChildAge || !newChildGrade || !newChildDOB || !newChildGender || !newChildLanguage || !newChildBoard || !newChildRelationship) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (!consentDataCollection || !consentDPDP || !acknowledgeDevelopment) {
      toast({
        title: "Consent Required",
        description: "Please accept all required consents to continue",
        variant: "destructive",
      });
      return;
    }
    
    const childName = newChildName;
    setIsAddingChild(true);
    try {
      const result = await createChild({
        name: newChildName,
        age: parseInt(newChildAge),
        grade: newChildGrade,
        school: newChildSchool || undefined,
        gender: newChildGender || undefined,
        dateOfBirth: newChildDOB || undefined,
        bloodGroup: newChildBloodGroup || undefined,
        language: newChildLanguage || undefined,
        board: newChildBoard || undefined,
        city: newChildCity || undefined,
        state: newChildState || undefined,
        specialNeeds: newChildSpecialNeeds || undefined,
        studyHoursPerDay: newChildStudyHours ? studyHoursToNumber(newChildStudyHours) : undefined,
        favoriteSubjects: newChildFavoriteSubjects.length > 0 ? newChildFavoriteSubjects : undefined,
        weakSubjects: newChildWeakSubjects.length > 0 ? newChildWeakSubjects : undefined,
        learningStyle: newChildLearningStyle || undefined,
        careerInterest: newChildCareerInterest || undefined,
        relationship: newChildRelationship || undefined,
        schoolType: newChildSchoolType || undefined,
        medium: newChildMedium || undefined,
        extracurricular: newChildExtracurricular || undefined,
        emergencyContact: newChildEmergencyContact || undefined,
        medicalConditions: newChildMedicalConditions || undefined,
        lbiConsent: consentBehavioral,
        consentGiven: consentDataCollection,
      });
      
      // Store newly created child ID and advance to goal-setting step
      const resultWithCreds = result as typeof result & { studentCredentials?: { username: string; password: string }; id?: string };
      setNewlyRegisteredChildId(resultWithCreds.id ?? null);
      setAddChildStep(5);
      
      // Show student credentials card if auto-created
      if (resultWithCreds.studentCredentials) {
        setNewChildCredentials({
          childName,
          username: resultWithCreds.studentCredentials.username,
          password: resultWithCreds.studentCredentials.password,
        });
      }
      
      loadDashboard();
    } catch (error: any) {
      console.error('Add child error:', error);
      toast({
        title: "Registration Failed",
        description: error.message === "Unauthorized" 
          ? "Please log in to register a child" 
          : (error.message || "Failed to register child. Please try again."),
        variant: "destructive",
      });
    } finally {
      setIsAddingChild(false);
    }
  };

  const handleSaveFirstGoal = (skip: boolean) => {
    const childId = newlyRegisteredChildId;
    if (!skip && firstGoalTitle.trim() && childId) {
      const key = `metryx_goals_${childId}`;
      const existing = (() => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } })();
      const goal = {
        id: `goal_${Date.now()}`,
        childId,
        title: firstGoalTitle.trim(),
        description: firstGoalDescription.trim(),
        category: firstGoalCategory,
        targetDate: firstGoalTargetDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        status: 'active',
        progress: 0,
        milestones: [],
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem(key, JSON.stringify([...existing, goal]));
      toast({ title: 'Goal set!', description: `"${goal.title}" has been added as ${newChildName}'s first goal.` });
    }
    setIsAddChildOpen(false);
    resetAddChildForm();
  };

  const handleSwitchChild = (childId: string) => {
    loadDashboard(childId);
    if (onChildChange) onChildChange(childId);
  };

  const handleConsentAction = async () => {
    if (!dashboardData?.selectedChild) return;
    
    try {
      await updateConsent(dashboardData.selectedChild.id, consentAction);
      
      toast({
        title: "Success",
        description: `Consent ${consentAction === 'grant' ? 'granted' : 'revoked'} successfully`,
      });
      
      setIsConsentDialogOpen(false);
      loadDashboard(dashboardData.selectedChild.id);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update consent",
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    } catch {}
    localStorage.removeItem('metryx_token');
    localStorage.removeItem('metryx_user');
    localStorage.removeItem('metryx_dashboard');
    window.dispatchEvent(new CustomEvent('metryx:logout'));
  };

  const selectedChild = dashboardData?.selectedChild;
  const isMinor = selectedChild && selectedChild.age < 18;
  const hasConsent = selectedChild?.lbiConsent;
  const canAccessLBI = !isMinor || hasConsent;

  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).filter(Boolean).join('').toUpperCase().slice(0, 2);
  };

  const fingerprintRef = useRef<HTMLDivElement>(null);

  const computeBurnoutRisk = (data: typeof dashboardData, child: typeof selectedChild): { level: 'low' | 'moderate' | 'high'; score: number; reasons: string[] } => {
    if (!data || !child) return { level: 'low', score: 0, reasons: [] };
    let score = 0;
    const reasons: string[] = [];
    const pending = data.exams?.filter(e => e.status === 'pending') || [];
    const completed = data.exams?.filter(e => e.status === 'completed' && e.score != null) || [];
    const lowScores = completed.filter(e => (e.score || 0) < 50);
    if (pending.length >= 3) { score += 30; reasons.push(`${pending.length} exams pending simultaneously`); }
    else if (pending.length >= 2) { score += 15; reasons.push(`${pending.length} exams pending`); }
    if (lowScores.length >= 2) { score += 25; reasons.push(`${lowScores.length} exams scored below 50%`); }
    if (!child.educationBoard) { score += 10; reasons.push('Education board not configured'); }
    if (isMinor && !child.lbiConsent) { score += 10; reasons.push('LBI consent pending'); }
    if (data.insights?.length === 0 && child.lbiConsent) { score += 10; reasons.push('No LBI baseline established'); }
    const level = score >= 50 ? 'high' : score >= 25 ? 'moderate' : 'low';
    return { level, score, reasons };
  };

  const burnoutRisk = computeBurnoutRisk(dashboardData, selectedChild);

  const downloadFingerprint = () => {
    const el = fingerprintRef.current;
    if (!el) return;
    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = el.offsetWidth * scale;
    canvas.height = el.offsetHeight * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = data;
    a.download = `${selectedChild?.name?.replace(/\s/g, '_')}_behavioral_fingerprint.png`;
    a.click();
    if (typeof window !== 'undefined') {
      import('html2canvas').then(({ default: html2canvas }) => {
        html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true }).then(c => {
          const link = document.createElement('a');
          link.href = c.toDataURL('image/png');
          link.download = `${selectedChild?.name?.replace(/\s/g, '_')}_fingerprint.png`;
          link.click();
        });
      }).catch(() => {});
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: BRAND.bg }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: BRAND.navy }}></div>
          <p className="text-sm text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const PARENT_SECTION_TITLES: Record<string, string> = {
    dashboard: 'Dashboard', education: 'Education Planner', 'exam-ready': 'Exam Readiness',
    lbi: 'LBI Assessment', 'exam-trends': 'Exam Analytics', 'ai-powered-reports': 'AI Reports',
    'metryxai-assistant': 'MetryxAI', 'my-packages': 'My Packages',
    'mentor-services': 'Mentor Services', 'learning-collab': 'Learning Collab',
  };

  return (
    <div className="parent-dashboard min-h-screen bg-[#f8fafc] flex flex-col font-sans">
      <AppTopBar
        title={PARENT_SECTION_TITLES[activeMenuItem] ?? 'Parent Portal'}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        onSearch={() => setShowSearch(true)}
        onTour={() => setShowTour(true)}
        onLogout={handleLogout}
      />

      <div className="flex flex-1 max-w-[1400px] mx-auto w-full px-4 py-6 gap-6">
        {/* ── Career Builder-style Sidebar ── */}
        <aside className={`shrink-0 transition-all duration-300 hidden md:block ${sidebarOpen ? 'w-56' : 'w-14'}`}>
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden sticky top-[56px]">

            {/* User card */}
            {sidebarOpen && (
              <div className="px-4 py-4 border-b border-gray-100">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold mb-2"
                  style={{ background: BRAND.navy }}>
                  {getInitials(userData?.fullName || userData?.username)}
                </div>
                <div className="text-xs font-semibold text-gray-800 truncate">
                  {userData?.fullName || userData?.username || 'Parent'}
                </div>
                <div className="text-2xs text-gray-400 truncate">
                  Parent Portal &nbsp;·&nbsp; {dashboardData?.children?.length ?? 0} {dashboardData?.children?.length === 1 ? 'child' : 'children'}
                </div>

                {/* Progress bar */}
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{
                      width: `${Math.min((dashboardData?.exams?.filter(e => e.status === 'completed').length ?? 0) * 20, 100)}%`,
                      backgroundColor: BRAND.accent
                    }} />
                  </div>
                  <span className="text-2xs text-gray-400">{Math.min((dashboardData?.exams?.filter(e => e.status === 'completed').length ?? 0) * 20, 100)}%</span>
                </div>
              </div>
            )}

            {/* Sidebar Nav */}
            <nav className="p-2 space-y-0.5">
              {[
                { id: 'dashboard',          label: 'Dashboard',         icon: <BarChart3 size={16} /> },
                { id: 'education',          label: 'Education Planner', icon: <GraduationCap size={16} /> },
                { id: 'exam-ready',         label: 'Exam Readiness',    icon: <Target size={16} /> },
                { id: 'lbi',               label: 'LBI Assessment',    icon: <Brain size={16} /> },
                { id: 'exam-trends',        label: 'Exam Analytics',    icon: <TrendingUp size={16} /> },
                { id: 'ai-powered-reports', label: 'AI Reports',        icon: <Sparkles size={16} /> },
                { id: 'metryxai-assistant', label: 'MetryxAI',          icon: <MessageSquare size={16} /> },
                { id: 'my-packages',        label: 'My Packages',       icon: <Star size={16} /> },
                { id: 'mentor-services',    label: 'Mentor Services',   icon: <Video size={16} /> },
                { id: 'learning-collab',    label: 'Learning Collab',   icon: <Users size={16} /> },
              ].map(t => (
                <button key={t.id} onClick={() => handleMenuSelect(t.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    activeMenuItem === t.id ? 'text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                  style={activeMenuItem === t.id ? { backgroundColor: BRAND.navy } : {}}>
                  <span className="shrink-0">{t.icon}</span>
                  {sidebarOpen && <span>{t.label}</span>}
                </button>
              ))}
            </nav>

            {/* Bottom actions */}
            <div className="p-2 border-t border-gray-100 space-y-0.5">
              {userData && userData.roles && userData.roles.length > 1 && sidebarOpen && (
                <div className="px-2 pb-1">
                  <RoleSwitcher currentRole={userData.role} availableRoles={userData.roles} onRoleChange={handleRoleChange} variant="minimal" />
                </div>
              )}
              <button
                onClick={() => setShowTour(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs hover:bg-gray-50 transition-colors"
                style={{ color: BRAND.accent }}
              >
                <Play size={15} />
                {sidebarOpen && <span className="font-medium">Quick Tour</span>}
              </button>
              <button onClick={() => setHelpOpen(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600">
                <HelpCircle size={16} />
                {sidebarOpen && <span>Help & Guides</span>}
              </button>
              <button onClick={() => loadDashboard(selectedChild?.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                data-testid="btn-refresh-dashboard">
                <RefreshCw size={16} />
                {sidebarOpen && <span>Refresh</span>}
              </button>
              <button onClick={() => setSidebarOpen(!sidebarOpen)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600">
                <ChevronRight size={16} className={`transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} />
                {sidebarOpen && <span>Collapse</span>}
              </button>
              {sidebarOpen && (
                <div className="pt-2 pb-1">
                  <p className="text-2xs font-bold tracking-widest uppercase px-3 mb-1.5" style={{ color: '#9AA4B2' }}>Switch to</p>
                  <div className="space-y-0.5">
                    {([
                      { label: 'Student view', icon: <BookOpen size={14} />, action: () => onNavigate('student-dashboard' as any), always: true },
                      { label: 'Mentor dashboard', icon: <BarChart2 size={14} />, action: () => onNavigate('mentor-dashboard' as any), show: userData?.roles?.includes('mentor') },
                      { label: 'Institution', icon: <School size={14} />, action: () => onNavigate('unified-institute-dashboard' as any), show: userData?.roles?.includes('institute') },
                      { label: 'Super admin', icon: <Shield size={14} />, action: () => onNavigate('super-admin' as any), show: userData?.roles?.includes('admin') },
                    ] as { label: string; icon: React.ReactNode; action: () => void; always?: boolean; show?: boolean }[])
                      .filter(item => item.always || item.show)
                      .map((item) => (
                        <button key={item.label} onClick={item.action}
                          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs hover:bg-gray-50 transition-colors"
                          style={{ color: BRAND.navy }}>
                          {item.icon}
                          <span className="font-medium">{item.label}</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}
              <button onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-400 hover:bg-[#EDF2F7] hover:text-brand-navy"
                data-testid="button-logout">
                <LogOut size={16} />
                {sidebarOpen && <span>Sign Out</span>}
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 min-w-0">
          {/* Inline alert strip for selected child */}
          {dashboardData && selectedChild && (() => {
            const alerts: { icon: React.ReactNode; text: string; color: string; bg: string; action?: () => void }[] = [];
            if (!selectedChild.educationBoard)
              alerts.push({ icon: <AlertCircle size={11} />, text: `Set ${selectedChild.name}'s board to unlock curriculum`, color: BRAND.navy, bg: 'rgba(11,60,93,0.04)', action: () => { setPendingBoard(''); setShowSetBoardModal(true); } });
            if (!selectedChild.lbiConsent)
              alerts.push({ icon: <Shield size={11} />, text: `Grant LBI consent for ${selectedChild.name} to start assessments`, color: BRAND.navy, bg: '#EDF2F7' });
            if (alerts.length === 0) return null;
            return (
              <div className="flex flex-wrap gap-2 mb-4">
                {alerts.map((a, i) => (
                  a.action ? (
                    <button key={i} onClick={a.action}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-2xs font-medium hover:opacity-80 transition-opacity"
                      style={{ background: a.bg, border: `1px solid ${a.color}33`, color: a.color }}>
                      {a.icon} {a.text}
                      <span className="text-2xs font-bold ml-0.5">→ Fix</span>
                    </button>
                  ) : (
                    <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-2xs font-medium"
                      style={{ background: a.bg, color: a.color }}>
                      {a.icon} {a.text}
                    </div>
                  )
                ))}
              </div>
            );
          })()}

          {/* ── HEADER PLACEHOLDER (old sticky header code relocated here) ── */}
          <div style={{ display: 'none' }}>
            {/* Row 1: Greeting bar (clean white) */}
            <div className="px-4 py-2.5 border-b border-gray-100">
              <div className="container max-w-7xl mx-auto flex items-center justify-between">
                {/* Left: Avatar + greeting */}
                <div className="flex items-center gap-3">
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ backgroundColor: BRAND.navy }}
                  >
                    {getInitials(userData?.fullName || userData?.username)}
                  </div>
                  <div>
                    <h1 className="text-sm font-bold text-gray-900 leading-tight" data-testid="text-parent-greeting">
                      Welcome back, {userData?.fullName?.split(' ')[0] || userData?.username || 'Parent'}
                    </h1>
                    <p className="text-2xs text-gray-400 leading-tight mt-0.5">
                      Parent Portal &nbsp;·&nbsp; {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                {/* Right: actions */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowSearch(true)}
                    className="hidden sm:flex items-center gap-2 h-7 px-2.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                    title="Search (⌘K)"
                    data-testid="btn-global-search"
                  >
                    <Search size={12} />
                    <span>Search</span>
                    <kbd className="ml-0.5 text-2xs px-1 py-0.5 rounded font-mono border border-gray-200 bg-gray-50">⌘K</kbd>
                  </button>
                  <NotificationCenter variant="dark" />
                  <button
                    onClick={() => setShowTour(true)}
                    className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-semibold border transition-colors"
                    style={{ borderColor: `${BRAND.accent}40`, color: BRAND.accent, background: `${BRAND.accent}08` }}
                    title="Quick tour of the dashboard"
                  >
                    <Play size={11} />
                    <span className="hidden sm:inline">Tour</span>
                  </button>
                  <button
                    onClick={() => setHelpOpen(true)}
                    className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors border border-gray-200"
                    data-testid="btn-help-panel"
                    title="Help & feature guides"
                  >
                    <HelpCircle size={12} />
                    <span className="hidden sm:inline">Help</span>
                  </button>
                  <button
                    onClick={() => loadDashboard(selectedChild?.id)}
                    className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors border border-gray-200"
                    data-testid="btn-refresh-dashboard"
                  >
                    <RefreshCw size={12} />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                  {userData && userData.roles && userData.roles.length > 1 && (
                    <RoleSwitcher
                      currentRole={userData.role}
                      availableRoles={userData.roles}
                      onRoleChange={handleRoleChange}
                      variant="minimal"
                    />
                  )}
                  <button onClick={handleLogout} className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium text-gray-500 hover:text-brand-navy hover:bg-[#EDF2F7] transition-colors md:hidden border border-gray-200" data-testid="button-logout">
                    <LogOut size={12} />
                  </button>
                </div>
              </div>
            </div>

          {/* Row 2: Children selector strip */}
          {dashboardData && dashboardData.children.length > 0 && (
            <div className="px-4 py-2.5 bg-white border-b" style={{ borderColor: BRAND.border }}>
              <div className="container max-w-7xl mx-auto">
                <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-hide">
                  {dashboardData.children.map((child) => {
                    const isSelected = selectedChild?.id === child.id;
                    const ageBand = child.age <= 10 ? 'A' : child.age <= 14 ? 'B' : 'C';
                    const ageBandLabel = { A: 'Primary', B: 'Middle', C: 'Senior' }[ageBand];
                    const completedExams = dashboardData.exams?.filter(e => e.status === 'completed').length ?? 0;
                    const childRisk = isSelected ? burnoutRisk : computeBurnoutRisk(dashboardData, child);
                    const riskColor = childRisk.level === 'high' ? BRAND.navy : childRisk.level === 'moderate' ? BRAND.navy : BRAND.accent;

                    return (
                      <button
                        key={child.id}
                        onClick={() => handleSwitchChild(child.id)}
                        className="shrink-0 text-left rounded-xl transition-all duration-150 overflow-hidden"
                        style={{
                          border: isSelected ? `1.5px solid ${BRAND.navy}` : `1.5px solid ${BRAND.border}`,
                          background: isSelected ? '#EDF2F7' : '#FAFBFC',
                          boxShadow: isSelected ? '0 1px 6px rgba(11,60,93,0.12)' : 'none',
                          minWidth: 200,
                        }}
                        data-testid={`child-strip-${child.id}`}
                      >
                        {/* Card top — selected accent bar */}
                        {isSelected && (
                          <div className="h-0.5 w-full" style={{ background: BRAND.navy }} />
                        )}

                        <div className="flex items-start gap-2.5 px-3 py-2.5">
                          {/* Avatar */}
                          <div
                            className="h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                            style={{ background: isSelected ? BRAND.navy : BRAND.slate }}
                          >
                            {getInitials(child.name)}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            {/* Name + active check + burnout dot */}
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span
                                className="text-xs font-bold truncate"
                                style={{ color: isSelected ? BRAND.navy : '#2E3440' }}
                              >
                                {child.name}
                              </span>
                              {isSelected && (
                                <CheckCircle size={12} style={{ color: BRAND.accent, flexShrink: 0 }} />
                              )}
                              <span
                                title={`Burnout risk: ${childRisk.level}`}
                                className="inline-block w-2 h-2 rounded-full shrink-0"
                                style={{ background: riskColor, boxShadow: `0 0 0 2px ${riskColor}33` }}
                              />
                            </div>

                            {/* Grade · age · band */}
                            <p className="text-2xs mb-1.5" style={{ color: '#9AA4B2' }}>
                              {child.grade || 'No Grade'} &nbsp;·&nbsp; {child.age} yrs &nbsp;·&nbsp; Band {ageBand} ({ageBandLabel})
                            </p>

                            {/* Status pills row */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* Board status */}
                              <span
                                className="inline-flex items-center gap-1 text-2xs font-semibold px-1.5 py-0.5 rounded-md"
                                style={child.educationBoard
                                  ? { background: 'rgba(11,60,93,0.08)', color: BRAND.navy }
                                  : { background: 'rgba(11,60,93,0.04)', color: BRAND.navy, border: '1px solid rgba(11,60,93,0.15)' }
                                }
                              >
                                {child.educationBoard ? (
                                  <>{child.educationBoard}</>
                                ) : (
                                  <><AlertCircle size={9} /> Set Board</>
                                )}
                              </span>

                              {/* LBI status */}
                              <span
                                className="inline-flex items-center gap-1 text-2xs font-semibold px-1.5 py-0.5 rounded-md"
                                style={child.lbiConsent
                                  ? { background: 'rgba(78,205,196,0.10)', color: BRAND.accent }
                                  : { background: '#EDF2F7', color: BRAND.navy, border: '1px solid #FECDD3' }
                                }
                              >
                                {child.lbiConsent ? (
                                  <><CheckCircle size={9} /> LBI Active</>
                                ) : (
                                  <><AlertCircle size={9} /> Consent Needed</>
                                )}
                              </span>

                              {/* Assessment count — only for selected child where we have data */}
                              {isSelected && completedExams > 0 && (
                                <span
                                  className="inline-flex items-center gap-1 text-2xs font-semibold px-1.5 py-0.5 rounded-md"
                                  style={{ background: '#F0FDFA', color: BRAND.accent }}
                                >
                                  <Award size={9} /> {completedExams} done
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  {/* Add Child */}
                  <button
                    onClick={() => setIsAddChildOpen(true)}
                    className="shrink-0 flex flex-col items-center justify-center gap-1 rounded-xl transition-all duration-150"
                    style={{
                      minWidth: 110,
                      minHeight: 90,
                      border: '1.5px dashed #CBD5E1',
                      background: '#FAFBFC',
                      color: '#5F6C80',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = BRAND.navy;
                      (e.currentTarget as HTMLElement).style.color = BRAND.navy;
                      (e.currentTarget as HTMLElement).style.background = '#EDF2F7';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = '#CBD5E1';
                      (e.currentTarget as HTMLElement).style.color = '#5F6C80';
                      (e.currentTarget as HTMLElement).style.background = '#FAFBFC';
                    }}
                    data-testid="btn-add-child-strip"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center mb-0.5"
                      style={{ background: '#EDF2F7' }}
                    >
                      <Plus size={15} style={{ color: BRAND.navy }} />
                    </div>
                    <span className="text-2xs font-semibold">Add Child</span>
                    <span className="text-2xs" style={{ color: '#9AA4B2' }}>Track another child</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Row 3: Smart status strip — alerts for the selected child */}
          {dashboardData && selectedChild && (() => {
            const alerts: { icon: React.ReactNode; text: string; color: string; bg: string }[] = [];
            const pendingExams = dashboardData.exams?.filter(e => e.status === 'pending') || [];
            const completedExams = dashboardData.exams?.filter(e => e.status === 'completed') || [];
            if (!selectedChild.educationBoard)
              alerts.push({ icon: <AlertCircle size={11} />, text: `Set ${selectedChild.name}'s education board to unlock curriculum content`, color: BRAND.navy, bg: 'rgba(11,60,93,0.04)', action: () => { setPendingBoard(''); setShowSetBoardModal(true); } } as any);
            if (!selectedChild.lbiConsent)
              alerts.push({ icon: <Shield size={11} />, text: `Grant LBI consent for ${selectedChild.name} to start behavioural assessments`, color: BRAND.navy, bg: '#EDF2F7' });
            if (pendingExams.length > 0)
              alerts.push({ icon: <Clock size={11} />, text: `${pendingExams.length} exam${pendingExams.length > 1 ? 's' : ''} pending for ${selectedChild.name}`, color: BRAND.navy, bg: '#EDF2F7' });
            if (completedExams.length > 0 && selectedChild.lbiConsent)
              alerts.push({ icon: <CheckCircle size={11} />, text: `${completedExams.length} assessment${completedExams.length > 1 ? 's' : ''} completed — AI report available`, color: BRAND.accent, bg: '#F0FDFA' });
            if (alerts.length === 0) return null;
            return (
              <div className="px-4 py-1.5 border-b overflow-x-auto scrollbar-hide" style={{ backgroundColor: '#FAFBFC', borderColor: BRAND.border }}>
                <div className="container max-w-7xl mx-auto flex items-center gap-3">
                  {alerts.map((a: any, i: number) => (
                    a.action ? (
                      <button
                        key={i}
                        onClick={a.action}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                        style={{ background: a.bg, border: `1px solid ${a.color}33` }}
                      >
                        <span style={{ color: a.color }}>{a.icon}</span>
                        <span className="text-2xs font-medium" style={{ color: a.color }}>{a.text}</span>
                        <span className="text-2xs font-bold ml-0.5" style={{ color: a.color }}>→ Fix now</span>
                      </button>
                    ) : (
                      <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full shrink-0" style={{ background: a.bg }}>
                        <span style={{ color: a.color }}>{a.icon}</span>
                        <span className="text-2xs font-medium" style={{ color: a.color }}>{a.text}</span>
                      </div>
                    )
                  ))}
                </div>
              </div>
            );
          })()}
          </div>{/* end hidden old header */}

          {/* Full Page Product Views */}
        {activeTab === 'ai-powered-reports' && (
          <div className="max-w-5xl mx-auto" data-testid="ai-reports-fullpage">
            <AIPoweredReports
              childName={selectedChild?.name}
              childAge={selectedChild?.age}
              childGrade={selectedChild?.grade}
              childId={selectedChild?.id}
              role="parent"
            />
          </div>
        )}

        {activeTab === 'lbi-product' && (
          <div className="max-w-5xl mx-auto" data-testid="lbi-product-fullpage">
            <LBIProductPage
              role="parent"
              onStartAssessment={() => onNavigate('parent-lbi', { childId: selectedChild?.id })}
            />
          </div>
        )}

        {activeTab === 'exam-ready' && (
          <div className="max-w-5xl mx-auto" data-testid="exam-ready-fullpage">
            <ExamReadinessPage
              role="parent"
              onStartAssessment={handleExamReadyStart}
            />
          </div>
        )}

        {activeTab === 'metryxai-assistant' && (
          <div className="max-w-5xl mx-auto" data-testid="metryxai-fullpage">
            <MetryxAIAssistantPage
              role="parent"
            />
          </div>
        )}

        {/* Enhanced Empty State with Trust Building */}
        {!['ai-powered-reports', 'lbi-product', 'exam-ready', 'metryxai-assistant'].includes(activeTab) && !selectedChild && (
          <div className="max-w-5xl mx-auto mt-2 space-y-4">
            {/* Welcome Hero - Brand Design */}
            <div className="overflow-hidden rounded-2xl shadow-xl border-0" data-testid="card-welcome-hero">
              <div 
                className="p-8 text-white relative overflow-hidden"
                style={{ backgroundColor: BRAND.navy }}
              >
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-white/20 -translate-y-1/2 translate-x-1/2" />
                  <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white/10 translate-y-1/2 -translate-x-1/2" />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
                  <div className="flex-1 text-center md:text-left">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-sm mb-3">
                      <Sparkles size={14} />
                      <span data-testid="text-hero-badge">Trusted by 50,000+ Parents</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold mb-2" data-testid="text-welcome-title">
                      Welcome to MetryxOne
                    </h1>
                    <p className="text-base text-white/90 mb-5" data-testid="text-welcome-subtitle">
                      Your trusted partner in your child's educational journey. Unlock powerful insights 
                      to help your child reach their full potential.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                      <Button 
                        onClick={() => setIsAddChildOpen(true)} 
                        size="lg" 
                        className="gap-2 bg-white hover:bg-white/90 text-brand-navy font-semibold shadow-lg"
                        data-testid="button-add-first-child"
                      >
                        <Plus size={18} />
                        Add Your First Child
                      </Button>
                      <Button 
                        variant="outline" 
                        size="lg" 
                        className="gap-2 border-white/30 text-white hover:bg-white/10 bg-transparent"
                        onClick={() => onNavigate('landing')}
                        data-testid="button-learn-more"
                      >
                        <Home size={16} />
                        Learn More
                      </Button>
                    </div>
                  </div>
                  <div className="hidden md:flex flex-col items-center">
                    <div className="w-40 h-40 rounded-full bg-white/10 flex items-center justify-center">
                      <div className="w-28 h-28 rounded-full bg-white/20 flex items-center justify-center">
                        <UserPlus size={36} className="text-white" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Preview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="stats-preview">
              <div className="bg-white border-t-2 border border-gray-100 rounded-2xl p-3 text-center shadow-sm" style={{ borderTopColor: BRAND.navy }} data-testid="stat-students">
                <p className="text-2xl font-bold" style={{ color: BRAND.navy }} data-testid="text-stat-students">50K+</p>
                <p className="text-xs text-muted-foreground" data-testid="text-stat-students-label">Students</p>
              </div>
              <div className="bg-white border-t-2 border border-gray-100 rounded-2xl p-3 text-center shadow-sm" style={{ borderTopColor: BRAND.accent }} data-testid="stat-satisfaction">
                <p className="text-2xl font-bold" style={{ color: BRAND.accent }} data-testid="text-stat-satisfaction">98%</p>
                <p className="text-xs text-muted-foreground" data-testid="text-stat-satisfaction-label">Satisfaction</p>
              </div>
              <div className="bg-white border-t-2 border border-gray-100 rounded-2xl p-3 text-center shadow-sm" style={{ borderTopColor: BRAND.navy }} data-testid="stat-modules">
                <p className="text-2xl font-bold" style={{ color: BRAND.navy }} data-testid="text-stat-modules">19+</p>
                <p className="text-xs text-muted-foreground" data-testid="text-stat-modules-label">Modules</p>
              </div>
              <div className="bg-white border-t-2 border border-gray-100 rounded-2xl p-3 text-center shadow-sm" style={{ borderTopColor: BRAND.accent }} data-testid="stat-agegroups">
                <p className="text-2xl font-bold" style={{ color: BRAND.accent }} data-testid="text-stat-agegroups">4</p>
                <p className="text-xs text-muted-foreground" data-testid="text-stat-agegroups-label">Age Groups</p>
              </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Features - Takes 2 columns */}
              <div className="lg:col-span-2 space-y-3">
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm" data-testid="card-features">
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: BRAND.navy }}>
                        <Award size={18} className="text-white" />
                      </div>
                      <h3 className="text-base font-semibold text-gray-800" data-testid="text-features-title">What You'll Get</h3>
                    </div>
                    <p className="text-xs text-gray-400 ml-10" data-testid="text-features-desc">Comprehensive tools to support your child's education</p>
                  </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex items-start gap-3 p-4 rounded-xl border hover:shadow-sm transition-shadow" data-testid="feature-academic">
                        <div className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: BRAND.navy }}>
                          <GraduationCap size={20} className="text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm" data-testid="text-feature-academic-title">Academic Progress Tracking</p>
                          <p className="text-xs text-muted-foreground mt-1" data-testid="text-feature-academic-desc">Monitor exams, scores, and improvement areas in real-time</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-4 rounded-xl border hover:shadow-sm transition-shadow" data-testid="feature-behavioral">
                        <div className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: BRAND.accent }}>
                          <Brain size={20} className="text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm" data-testid="text-feature-behavioral-title">Behavioral Insights (Lbi)</p>
                          <p className="text-xs text-muted-foreground mt-1" data-testid="text-feature-behavioral-desc">Understand learning patterns and emotional intelligence</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-4 rounded-xl border hover:shadow-sm transition-shadow" data-testid="feature-examready">
                        <div className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: BRAND.navy }}>
                          <Activity size={20} className="text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm" data-testid="text-feature-examready-title">ExamReadiness Index™ Assessment</p>
                          <p className="text-xs text-muted-foreground mt-1" data-testid="text-feature-examready-desc">Measure psychological exam preparedness scientifically</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-4 rounded-xl border hover:shadow-sm transition-shadow" data-testid="feature-supervised">
                        <div className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: BRAND.accent }}>
                          <Eye size={20} className="text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm" data-testid="text-feature-supervised-title">Supervised Test Mode</p>
                          <p className="text-xs text-muted-foreground mt-1" data-testid="text-feature-supervised-desc">Monitor your child's exams in real-time from anywhere</p>
                        </div>
                      </div>
                    </div>
                </div>

                {/* How It Works */}
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm" data-testid="card-how-it-works">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: BRAND.accent }}>
                      <Lightbulb size={18} className="text-white" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-800" data-testid="text-howit-title">How It Works</h3>
                  </div>
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1 text-center p-4" data-testid="step-register">
                        <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center text-white font-bold mb-3" style={{ backgroundColor: BRAND.navy }}>1</div>
                        <p className="font-semibold text-sm" data-testid="text-step-register">Register Child</p>
                        <p className="text-xs text-muted-foreground mt-1" data-testid="text-step-register-desc">Add your child's profile with required details</p>
                      </div>
                      <div className="hidden md:flex items-center">
                        <ChevronDown className="rotate-[-90deg] text-muted-foreground" />
                      </div>
                      <div className="flex-1 text-center p-4" data-testid="step-consent">
                        <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center text-white font-bold mb-3" style={{ backgroundColor: BRAND.accent }}>2</div>
                        <p className="font-semibold text-sm" data-testid="text-step-consent">Grant Consent</p>
                        <p className="text-xs text-muted-foreground mt-1" data-testid="text-step-consent-desc">Provide secure consent for assessments</p>
                      </div>
                      <div className="hidden md:flex items-center">
                        <ChevronDown className="rotate-[-90deg] text-muted-foreground" />
                      </div>
                      <div className="flex-1 text-center p-4" data-testid="step-insights">
                        <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center text-white font-bold mb-3" style={{ backgroundColor: BRAND.navy }}>3</div>
                        <p className="font-semibold text-sm" data-testid="text-step-insights">Get Insights</p>
                        <p className="text-xs text-muted-foreground mt-1" data-testid="text-step-insights-desc">Receive detailed reports and recommendations</p>
                      </div>
                    </div>
                </div>
              </div>

              {/* Trust & Security - Takes 1 column */}
              <div className="space-y-3">
                {/* Trust Badges */}
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm" data-testid="trust-badges-container">
                  <h3 className="text-sm font-semibold text-gray-800 mb-4" data-testid="text-trust-title">Why Parents Trust Us</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-[#EDF7F2]" data-testid="trust-badge-dpdp">
                      <div className="h-10 w-10 rounded-full bg-[#C9E8D8] flex items-center justify-center flex-shrink-0">
                        <Shield size={20} className="text-brand-accent" />
                      </div>
                      <div>
                        <p className="font-semibold text-xs" data-testid="text-dpdp-title">Data Protection Compliant</p>
                        <p className="text-xs text-muted-foreground" data-testid="text-dpdp-desc">Indian privacy laws</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: 'rgba(11,60,93,0.08)' }} data-testid="trust-badge-encryption">
                      <div className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(11,60,93,0.15)' }}>
                        <Lock size={20} style={{ color: BRAND.navy }} />
                      </div>
                      <div>
                        <p className="font-semibold text-xs" data-testid="text-encryption-title">256-bit Encryption</p>
                        <p className="text-xs text-muted-foreground" data-testid="text-encryption-desc">Bank-grade security</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: 'rgba(78,205,196,0.08)' }} data-testid="trust-badge-development">
                      <div className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(78,205,196,0.15)' }}>
                        <Target size={20} style={{ color: BRAND.accent }} />
                      </div>
                      <div>
                        <p className="font-semibold text-xs" data-testid="text-development-title">Child-First Approach</p>
                        <p className="text-xs text-muted-foreground" data-testid="text-development-desc">Data for their growth only</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'rgba(11,60,93,0.06)' }} data-testid="trust-badge-parental">
                      <div className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(11,60,93,0.12)' }}>
                        <Users size={20} style={{ color: BRAND.navy }} />
                      </div>
                      <div>
                        <p className="font-semibold text-xs" data-testid="text-parental-title">Parental Control</p>
                        <p className="text-xs text-muted-foreground" data-testid="text-parental-desc">Full consent management</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Security Commitment */}
                <div className="bg-white border-2 border border-gray-100 rounded-2xl p-5 shadow-sm" style={{ borderColor: BRAND.accent }} data-testid="card-security-commitment">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield size={18} style={{ color: BRAND.accent }} />
                    <p className="font-semibold text-sm" data-testid="text-security-title">Our Security Promise</p>
                  </div>
                  <ul className="space-y-2 text-xs text-muted-foreground" data-testid="text-security-description">
                    <li className="flex items-start gap-2">
                      <CheckCircle size={14} className="text-brand-accent mt-0.5 flex-shrink-0" />
                      <span data-testid="text-security-india">Data stored securely in India</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle size={14} className="text-brand-accent mt-0.5 flex-shrink-0" />
                      <span data-testid="text-security-nosale">Never sold to third parties</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle size={14} className="text-brand-accent mt-0.5 flex-shrink-0" />
                      <span data-testid="text-security-delete">Delete data anytime</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle size={14} className="text-brand-accent mt-0.5 flex-shrink-0" />
                      <span data-testid="text-security-policies">Transparent usage policies</span>
                    </li>
                  </ul>
                </div>

                {/* CTA Card */}
                <div className="rounded-2xl p-6 text-center text-white shadow-sm" style={{ backgroundColor: BRAND.navy }}>
                  <h3 className="font-bold mb-2" data-testid="text-cta-title">Ready to Start?</h3>
                  <p className="text-sm text-white/80 mb-4" data-testid="text-cta-desc">Register your child in under 2 minutes</p>
                  <Button 
                    onClick={() => setIsAddChildOpen(true)}
                    className="w-full bg-white hover:bg-white/90 text-brand-navy font-semibold"
                    data-testid="button-cta-add-child"
                  >
                    <Plus size={16} className="mr-2" />
                    Add Child Now
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {!['ai-powered-reports', 'lbi-product', 'exam-ready', 'metryxai-assistant'].includes(activeTab) && selectedChild && (
          <>
            {/* Compact Quick Actions Strip */}
            <div className="mb-4 px-4 py-2.5 bg-white rounded-xl border shadow-sm flex items-center justify-between gap-3 flex-wrap" data-testid="quick-actions-strip">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 mr-2 pr-3 border-r">
                  <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: BRAND.navy }}>
                    {getInitials(selectedChild.name)}
                  </div>
                  <span className="text-sm font-semibold" style={{ color: BRAND.navy }}>{selectedChild.name}</span>
                  {dashboardData?.stats && dashboardData.stats.pending > 0 && (
                    <Badge variant="outline" className="text-2xs h-5 border-[#B8CCDA] text-brand-navy">
                      {dashboardData.stats.pending} pending
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  className="h-7 px-3 text-xs gap-1.5 text-white"
                  style={{ backgroundColor: BRAND.accent }}
                  onClick={() => onNavigate('parent-lbi', { childId: selectedChild.id })}
                  data-testid="quick-action-lbi"
                  title="Learning Behaviour Index — a 19-domain assessment that maps your child's behavioural intelligence. Grant consent first if your child is under 18."
                >
                  <Brain size={12} />
                  LBI Assessment
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-3 text-xs gap-1.5"
                  style={{ borderColor: BRAND.navy, color: BRAND.navy }}
                  onClick={handleExamReadyStart}
                  data-testid="quick-action-examready"
                  title="Exam Readiness — measures how mentally prepared your child is for an upcoming exam. Reviews stress, confidence and time management."
                >
                  <Target size={12} />
                  ExamReadiness
                </Button>
                {isMinor && dashboardData?.exams?.some(e => e.status === 'pending') && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-3 text-xs gap-1.5"
                    style={{ borderColor: BRAND.navy, color: BRAND.navy }}
                    onClick={() => {
                      const pendingExam = dashboardData?.exams?.find(e => e.status === 'pending');
                      if (pendingExam) {
                        setSupervisedExamId(pendingExam.id);
                        setIsSupervisedTestOpen(true);
                      }
                    }}
                    data-testid="quick-action-supervised"
                  >
                    <Eye size={12} />
                    Supervised Test
                  </Button>
                )}
              </div>
              {isMinor && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-3 text-xs gap-1.5"
                  style={{ color: hasConsent ? BRAND.accent : BRAND.navy }}
                  onClick={() => {
                    setConsentAction(hasConsent ? 'revoke' : 'grant');
                    setIsConsentDialogOpen(true);
                  }}
                  data-testid="button-manage-consent"
                >
                  <Shield size={12} />
                  {hasConsent ? 'Manage Consent' : 'Grant Consent'}
                </Button>
              )}
            </div>

            {/* ── Horizontal Child Selector Strip ── */}
            {dashboardData && dashboardData.children.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
                <span className="text-2xs font-semibold uppercase tracking-widest text-gray-400 whitespace-nowrap shrink-0">Viewing Child</span>
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                  {dashboardData.children.map(c => {
                    const active = selectedChild?.id === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => handleSwitchChild(c.id)}
                        className={`shrink-0 text-left px-3 py-1.5 rounded-xl border transition-all ${
                          active
                            ? 'border-transparent text-white shadow-sm'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                        style={active ? { backgroundColor: BRAND.navy } : {}}
                      >
                        <div className="text-xs font-semibold leading-tight">{c.name}</div>
                        <div className={`text-2xs leading-tight ${active ? 'text-[#B8CCDA]' : 'text-gray-400'}`}>
                          {c.grade} · {c.age} yrs
                        </div>
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setIsAddChildOpen(true)}
                    className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl border border-dashed border-gray-300 text-xs text-gray-400 hover:border-gray-400 hover:text-gray-600 bg-white transition-all"
                  >
                    <Plus size={11} /> Add Child
                  </button>
                </div>
              </div>
            )}

            {/* Main Tabs - 7-Tab Navigation */}
            <div ref={tabsRef}>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="flex flex-wrap w-full h-auto p-1 rounded-xl bg-gray-100 gap-0.5">
                <TabsTrigger 
                  value="overview" 
                  className="flex-1 basis-auto gap-1 px-2.5 py-1.5 rounded-lg text-2xs font-medium text-gray-500 transition-all hover:text-gray-700 data-[state=active]:bg-white data-[state=active]:text-brand-navy data-[state=active]:font-semibold data-[state=active]:shadow-sm whitespace-nowrap"
                  data-testid="tab-overview"
                >
                  <Home size={12} />
                  <span>Home</span>
                </TabsTrigger>
                <TabsTrigger
                  value="goals"
                  className="flex-1 basis-auto gap-1 px-2.5 py-1.5 rounded-lg text-2xs font-medium text-gray-500 transition-all hover:text-gray-700 data-[state=active]:bg-white data-[state=active]:text-brand-navy data-[state=active]:font-semibold data-[state=active]:shadow-sm whitespace-nowrap"
                  data-testid="tab-goals"
                >
                  <Target size={12} />
                  <span>Goals</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="education" 
                  className="flex-1 basis-auto gap-1 px-2.5 py-1.5 rounded-lg text-2xs font-medium text-gray-500 transition-all hover:text-gray-700 data-[state=active]:bg-white data-[state=active]:text-brand-navy data-[state=active]:font-semibold data-[state=active]:shadow-sm whitespace-nowrap"
                  data-testid="tab-education"
                >
                  <Layers size={12} />
                  <span>Learning Hub</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="exam-trends" 
                  className="flex-1 basis-auto gap-1 px-2.5 py-1.5 rounded-lg text-2xs font-medium text-gray-500 transition-all hover:text-gray-700 data-[state=active]:bg-white data-[state=active]:text-brand-navy data-[state=active]:font-semibold data-[state=active]:shadow-sm whitespace-nowrap"
                  data-testid="tab-exam-trends"
                >
                  <PieChart size={12} />
                  <span>Analytics</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="lbi" 
                  className="flex-1 basis-auto gap-1 px-2.5 py-1.5 rounded-lg text-2xs font-medium text-gray-500 transition-all hover:text-gray-700 data-[state=active]:bg-white data-[state=active]:text-brand-navy data-[state=active]:font-semibold data-[state=active]:shadow-sm whitespace-nowrap"
                  data-testid="tab-lbi"
                >
                  <Brain size={12} />
                  <span>Behaviour</span>
                </TabsTrigger>
                <TabsTrigger
                  value="mentor-services"
                  className="flex-1 basis-auto gap-1 px-2.5 py-1.5 rounded-lg text-2xs font-medium text-gray-500 transition-all hover:text-gray-700 data-[state=active]:bg-white data-[state=active]:text-brand-navy data-[state=active]:font-semibold data-[state=active]:shadow-sm whitespace-nowrap"
                  data-testid="tab-mentor-services"
                >
                  <Video size={12} />
                  <span>Mentor Services</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="my-packages" 
                  className="flex-1 basis-auto gap-1 px-2.5 py-1.5 rounded-lg text-2xs font-medium text-gray-500 transition-all hover:text-gray-700 data-[state=active]:bg-white data-[state=active]:text-brand-navy data-[state=active]:font-semibold data-[state=active]:shadow-sm whitespace-nowrap"
                  data-testid="tab-my-packages"
                >
                  <Award size={12} />
                  <span>Packages</span>
                </TabsTrigger>
                <TabsTrigger
                  value="learning-collab"
                  className="flex-1 basis-auto gap-1 px-2.5 py-1.5 rounded-lg text-2xs font-medium text-gray-500 transition-all hover:text-gray-700 data-[state=active]:bg-white data-[state=active]:text-brand-navy data-[state=active]:font-semibold data-[state=active]:shadow-sm whitespace-nowrap"
                  data-testid="tab-learning-collab"
                >
                  <Users size={12} />
                  <span>Learning collab</span>
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab - Alerts, Summary, Quick Navigation */}
              <TabsContent value="overview" className="mt-6 space-y-5">
                {/* MX-302H — institutional placement-readiness (flag-gated; renders nothing when OFF) */}
                {selectedChild && (
                  <ParentPlacementReadinessCard childId={selectedChild.id} childName={selectedChild.name} />
                )}
                {/* Alerts & Notifications Panel */}
                {(() => {
                  type AlertEntry = {
                    type: 'action' | 'warning' | 'info' | 'success' | 'report';
                    category: string;
                    icon: React.ReactNode;
                    title: string;
                    desc: string;
                    action?: () => void;
                    actionLabel?: string;
                  };
                  const alerts: AlertEntry[] = [];
                  const now = new Date();
                  const todayStr = now.toISOString().slice(0, 10);

                  // ── PRIORITY 1: Action Required ─────────────────────────────
                  if (isMinor && !hasConsent) {
                    alerts.push({
                      type: 'action', category: 'LBI',
                      icon: <Shield size={15} className="text-brand-navy" />,
                      title: 'LBI Parental Consent Required',
                      desc: `Grant consent for ${selectedChild.name} to unlock behavioral intelligence & personalized learning insights`,
                      action: () => { setConsentAction('grant'); setIsConsentDialogOpen(true); },
                      actionLabel: 'Grant Now',
                    });
                  }

                  if (!selectedChild.educationBoard) {
                    alerts.push({
                      type: 'action', category: 'Profile',
                      icon: <AlertCircle size={15} className="text-brand-navy" />,
                      title: 'Education Board Not Set',
                      desc: `${selectedChild.name}'s education board is missing — curriculum content, exam alignment and AI recommendations require it`,
                      action: () => { setPendingBoard(''); setShowSetBoardModal(true); },
                      actionLabel: 'Set Now',
                    });
                  }

                  if (!selectedChild.grade) {
                    alerts.push({
                      type: 'action', category: 'Profile',
                      icon: <AlertCircle size={15} className="text-brand-navy" />,
                      title: 'Grade / Class Not Set',
                      desc: `Add ${selectedChild.name}'s current grade to unlock grade-appropriate assessments and study plans`,
                      action: () => { setPendingBoard(''); setShowSetBoardModal(true); },
                      actionLabel: 'Update Profile',
                    });
                  }

                  // ── PRIORITY 2: Planner Reminders ───────────────────────────
                  const overdueTasks = studyTasks.filter((t: any) => {
                    if (t.status === 'completed') return false;
                    if (!t.dueDate && !t.due_date) return false;
                    const due = new Date(t.dueDate || t.due_date);
                    return due < now;
                  });
                  if (overdueTasks.length > 0) {
                    alerts.push({
                      type: 'warning', category: 'Planner',
                      icon: <Clock size={15} className="text-brand-navy" />,
                      title: `${overdueTasks.length} Overdue Study Task${overdueTasks.length > 1 ? 's' : ''}`,
                      desc: `"${(overdueTasks[0] as any).title || (overdueTasks[0] as any).subject || 'Study task'}" is past due${overdueTasks.length > 1 ? ` and ${overdueTasks.length - 1} more` : ''} — review the planner`,
                      action: () => setActiveTab('education'),
                      actionLabel: 'Open Planner',
                    });
                  }

                  const todayTasks = studyTasks.filter((t: any) => {
                    if (t.status === 'completed') return false;
                    const due = t.dueDate || t.due_date;
                    return due && due.toString().slice(0, 10) === todayStr;
                  });
                  if (todayTasks.length > 0) {
                    alerts.push({
                      type: 'warning', category: 'Planner',
                      icon: <CalendarDays size={15} className="text-brand-navy" />,
                      title: `${todayTasks.length} Task${todayTasks.length > 1 ? 's' : ''} Due Today`,
                      desc: `"${(todayTasks[0] as any).title || (todayTasks[0] as any).subject || 'Study task'}" scheduled for today${todayTasks.length > 1 ? ` + ${todayTasks.length - 1} more` : ''}`,
                      action: () => setActiveTab('education'),
                      actionLabel: 'View Planner',
                    });
                  }

                  // ── PRIORITY 3: Exam Reminders ──────────────────────────────
                  const pendingExams = dashboardData?.exams?.filter(e => e.status === 'pending') || [];
                  if (pendingExams.length > 0) {
                    alerts.push({
                      type: 'warning', category: 'Exam',
                      icon: <FileText size={15} className="text-brand-navy" />,
                      title: `${pendingExams.length} Pending Exam${pendingExams.length > 1 ? 's' : ''}`,
                      desc: `"${pendingExams[0].title}" is awaiting completion${pendingExams.length > 1 ? ` · ${pendingExams.length - 1} more pending` : ''}`,
                      action: () => setActiveTab('education'),
                      actionLabel: 'View Exams',
                    });
                  }

                  // ── PRIORITY 4: Daily Report — Latest Exam Result ───────────
                  const completedExams = dashboardData?.exams?.filter(e => e.status === 'completed' && e.score !== null) || [];
                  if (completedExams.length > 0) {
                    const latest = completedExams[completedExams.length - 1];
                    const score = latest.score || 0;
                    alerts.push({
                      type: 'report', category: 'Daily Report',
                      icon: score >= 75
                        ? <Award size={15} style={{ color: BRAND.accent }} />
                        : score >= 50
                          ? <BarChart3 size={15} style={{ color: BRAND.navy }} />
                          : <TrendingDown size={15} className="text-brand-navy" />,
                      title: `Latest Result: ${latest.title}`,
                      desc: `Score ${score}% · ${score >= 75 ? 'Strong performance — keep the momentum!' : score >= 50 ? 'On track — some topics may need review' : 'Below average — a mentor or extra practice is recommended'}`,
                      action: () => setActiveTab('exam-trends'),
                      actionLabel: 'View Report',
                    });
                  }

                  // Low score alert (below 50%)
                  const lowScoreExams = completedExams.filter(e => (e.score || 0) < 50);
                  if (lowScoreExams.length > 0) {
                    alerts.push({
                      type: 'warning', category: 'Daily Report',
                      icon: <TrendingDown size={15} className="text-brand-navy" />,
                      title: `${lowScoreExams.length} Score${lowScoreExams.length > 1 ? 's' : ''} Below 50%`,
                      desc: `"${lowScoreExams[0].title}" scored ${lowScoreExams[0].score}%${lowScoreExams.length > 1 ? ` · ${lowScoreExams.length - 1} more` : ''} — consider booking a mentor session`,
                      action: () => setActiveTab('exam-trends'),
                      actionLabel: 'See Trends',
                    });
                  }

                  // ── PRIORITY 5: Weekly Performance Report ───────────────────
                  if (completedExams.length >= 2) {
                    const avg = Math.round(completedExams.reduce((s, e) => s + (e.score || 0), 0) / completedExams.length);
                    const recent = completedExams.slice(-3);
                    const recentAvg = Math.round(recent.reduce((s, e) => s + (e.score || 0), 0) / recent.length);
                    const trend = recentAvg > avg ? 'up' : recentAvg < avg - 5 ? 'down' : 'stable';
                    alerts.push({
                      type: 'report', category: 'Weekly Report',
                      icon: trend === 'up'
                        ? <TrendingUp size={15} style={{ color: BRAND.accent }} />
                        : trend === 'down'
                          ? <TrendingDown size={15} className="text-brand-navy" />
                          : <BarChart3 size={15} style={{ color: BRAND.navy }} />,
                      title: `Weekly Performance: Avg ${avg}% · ${trend === 'up' ? 'Improving' : trend === 'down' ? 'Declining' : 'Stable'}`,
                      desc: `${completedExams.length} assessments completed · Recent 3-exam avg ${recentAvg}% ${trend === 'up' ? '↑ trending up' : trend === 'down' ? '↓ needs attention' : '→ holding steady'}`,
                      action: () => setActiveTab('exam-trends'),
                      actionLabel: 'Full Report',
                    });

                    // ── T001: Predictive 4–6 Week Exam Risk Alert ─────────────
                    const pendingExams = dashboardData?.exams?.filter(e => e.status === 'pending') || [];
                    const upcomingInWindow = pendingExams.filter(e => {
                      const d = new Date(e.scheduledFor || e.createdAt || Date.now());
                      const weeksAway = (d.getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000);
                      return weeksAway >= 0 && weeksAway <= 6;
                    });
                    if (trend === 'down' && upcomingInWindow.length > 0) {
                      const drop = avg - recentAvg;
                      const riskLevel = drop >= 15 ? 'High' : 'Moderate';
                      alerts.push({
                        type: 'warning', category: 'Predictive Alert',
                        icon: <AlertTriangle size={15} className={riskLevel === 'High' ? 'text-brand-navy' : 'text-brand-navy'} />,
                        title: `${riskLevel} Risk: ${upcomingInWindow.length} Exam${upcomingInWindow.length > 1 ? 's' : ''} in the Next 4–6 Weeks`,
                        desc: `Score trend declined ${drop}% in recent assessments. Based on trajectory, ${selectedChild.name} may need intervention before upcoming exams. Book a mentor session to course-correct now.`,
                        action: () => setActiveTab('mentor-services'),
                        actionLabel: 'Book Mentor',
                      });
                    } else if (trend === 'stable' && recentAvg < 55 && upcomingInWindow.length > 0) {
                      alerts.push({
                        type: 'warning', category: 'Predictive Alert',
                        icon: <AlertTriangle size={15} className="text-brand-navy" />,
                        title: `Watch: ${upcomingInWindow.length} Upcoming Exam${upcomingInWindow.length > 1 ? 's' : ''} with Below-Average Score Base`,
                        desc: `Average score is ${recentAvg}% — below the 60% readiness threshold. Targeted practice now can significantly improve outcomes in the 4–6 week exam window.`,
                        action: () => setActiveTab('exam-trends'),
                        actionLabel: 'View Trends',
                      });
                    }
                  }

                  // ── PRIORITY 6: LBI / Behavioral Reports ───────────────────
                  if (hasConsent && (!dashboardData?.insights || dashboardData.insights.length === 0)) {
                    alerts.push({
                      type: 'info', category: 'LBI',
                      icon: <Brain size={15} style={{ color: BRAND.accent }} />,
                      title: 'No LBI Assessments Yet',
                      desc: `Consent granted — start ${selectedChild.name}'s behavioral assessment to generate domain insights and a personalized learning roadmap`,
                      action: () => onNavigate('parent-lbi', { childId: selectedChild.id }),
                      actionLabel: 'Start LBI',
                    });
                  } else if (!hasConsent && !isMinor) {
                    alerts.push({
                      type: 'info', category: 'LBI',
                      icon: <Brain size={15} style={{ color: BRAND.accent }} />,
                      title: 'LBI Assessment Available',
                      desc: `Map ${selectedChild.name}'s behavioral intelligence across 19 domains — unlock AI-driven study recommendations`,
                      action: () => onNavigate('parent-lbi', { childId: selectedChild.id }),
                      actionLabel: 'Begin Assessment',
                    });
                  }

                  // LBI domain concern (if any domain score below 60)
                  if (dashboardData?.insights && dashboardData.insights.length > 0) {
                    const lowDomains = dashboardData.insights.filter((i: any) => typeof i.value === 'number' && i.value < 60);
                    if (lowDomains.length > 0) {
                      const d = lowDomains[0];
                      alerts.push({
                        type: 'info', category: 'LBI',
                        icon: <Brain size={15} style={{ color: BRAND.accent }} />,
                        title: `LBI Alert: Low ${d.domain || d.label || 'Domain'} Score`,
                        desc: `${selectedChild.name} scored ${Math.round(d.value)}% in ${d.domain || d.label || 'this domain'} — targeted practice or a mentor session can help`,
                        action: () => setActiveTab('lbi'),
                        actionLabel: 'View Insights',
                      });
                    }
                  }

                  // ── PRIORITY 7: Burnout / Wellness ─────────────────────────
                  if (burnoutRisk.level !== 'low') {
                    alerts.push({
                      type: 'warning', category: 'Wellness',
                      icon: <Flame size={15} className={burnoutRisk.level === 'high' ? 'text-brand-navy' : 'text-brand-navy'} />,
                      title: `${burnoutRisk.level === 'high' ? 'High' : 'Moderate'} Academic Pressure Detected`,
                      desc: burnoutRisk.reasons.join(' · '),
                      action: () => setActiveTab('mentor-services'),
                      actionLabel: 'Book Mentor',
                    });
                  }

                  // ── PRIORITY 8: Mentor Session Confirmations ────────────────
                  const childMentorSessions = bookedMentorSessions.filter(s => s.childName === selectedChild.name);
                  childMentorSessions.slice(0, 3).forEach(s => {
                    const dateLabel = new Date(s.scheduledDate + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
                    alerts.push({
                      type: 'success', category: 'Mentor',
                      icon: <Video size={15} style={{ color: BRAND.navy }} />,
                      title: `Mentor Session Confirmed`,
                      desc: `${s.mentor.name} · ${s.sessionType} for ${s.childName} · ${dateLabel} at ${s.scheduledTime} — invite link sent`,
                      action: () => setActiveTab('mentor-services'),
                      actionLabel: 'View Session',
                    });
                  });

                  // Suggest booking if low scores and no mentor yet
                  if (lowScoreExams.length > 0 && childMentorSessions.length === 0) {
                    alerts.push({
                      type: 'info', category: 'Mentor',
                      icon: <Users size={15} style={{ color: BRAND.navy }} />,
                      title: 'Mentor Session Recommended',
                      desc: `${selectedChild.name} has ${lowScoreExams.length} low-scoring exam${lowScoreExams.length > 1 ? 's' : ''} — a mentor session can provide targeted support`,
                      action: () => setActiveTab('mentor-services'),
                      actionLabel: 'Find Mentor',
                    });
                  }

                  // ── PRIORITY 8b: Always-present smart suggestions ──────────
                  // Show these when there's not much activity yet so the panel is never empty
                  const hasNoActivity = completedExams.length === 0 && pendingExams.length === 0 && studyTasks.length === 0;
                  if (hasNoActivity && childMentorSessions.length === 0 && hasConsent) {
                    alerts.push({
                      type: 'info', category: 'Mentor',
                      icon: <Users size={15} style={{ color: BRAND.navy }} />,
                      title: 'Explore Mentor Services',
                      desc: `Connect ${selectedChild.name} with AI-matched mentors for personalised academic coaching, behavioral support, and exam preparation`,
                      action: () => setActiveTab('mentor-services'),
                      actionLabel: 'Browse Mentors',
                    });
                  }

                  if (hasNoActivity && !pendingExams.length) {
                    alerts.push({
                      type: 'info', category: 'Exam',
                      icon: <FileText size={15} style={{ color: BRAND.accent }} />,
                      title: 'Request a Practice Exam',
                      desc: `No assessments scheduled yet — assign a practice test to ${selectedChild.name} to baseline academic performance`,
                      action: () => setActiveTab('education'),
                      actionLabel: 'Go to Academics',
                    });
                  }

                  if (studyTasks.length === 0) {
                    alerts.push({
                      type: 'info', category: 'Planner',
                      icon: <CalendarDays size={15} className="text-brand-navy" />,
                      title: 'No Study Plan Yet',
                      desc: `Set up a weekly study schedule for ${selectedChild.name} to stay on track with curriculum goals and exam timelines`,
                      action: () => setActiveTab('education'),
                      actionLabel: 'Open Planner',
                    });
                  }

                  // ── PRIORITY 9: Positive Milestones ────────────────────────
                  if (completedExams.length >= 3) {
                    const avg = Math.round(completedExams.reduce((s, e) => s + (e.score || 0), 0) / completedExams.length);
                    if (avg >= 80) {
                      alerts.push({
                        type: 'success', category: 'Achievement',
                        icon: <Award size={15} style={{ color: BRAND.accent }} />,
                        title: `Excellent Performance — ${avg}% Average!`,
                        desc: `${selectedChild.name} is averaging ${avg}% across ${completedExams.length} assessments — outstanding academic consistency`,
                      });
                    }
                  }

                  if (completedExams.length === 5 || completedExams.length === 10 || completedExams.length === 25) {
                    alerts.push({
                      type: 'success', category: 'Milestone',
                      icon: <Sparkles size={15} className="text-brand-navy" />,
                      title: `Milestone: ${completedExams.length} Assessments Completed!`,
                      desc: `${selectedChild.name} has completed ${completedExams.length} assessments — great learning discipline`,
                    });
                  }

                  // ── Render ──────────────────────────────────────────────────
                  const categoryOrder = ['LBI', 'Profile', 'Planner', 'Exam', 'Daily Report', 'Weekly Report', 'Wellness', 'Mentor', 'Achievement', 'Milestone', 'Getting Started'];
                  const sorted = alerts.sort((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category));
                  return <SmartParentBanner alerts={sorted as SmartAlert[]} childName={selectedChild.name} />;
                })()}

                {/* ══ ROW A: Weekly Briefing (left 2/3) + Burnout Risk (right 1/3) ══ */}
                {(() => {
                  const now = new Date();
                  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + 1);
                  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
                  const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                  const pending = dashboardData?.exams?.filter(e => e.status === 'pending') || [];
                  const completed = dashboardData?.exams?.filter(e => e.status === 'completed') || [];
                  const avgScore = dashboardData?.stats?.avgScore || 0;
                  const insightCount = dashboardData?.insights?.length || 0;
                  const nextExam = pending[0];

                  const bullets: { dot: string; label: string; text: string; highlight?: boolean }[] = [];
                  if (pending.length > 0) bullets.push({ dot: BRAND.navy, label: 'EXAMS', text: `${pending.length} exam${pending.length > 1 ? 's' : ''} pending — ${nextExam?.title || 'view in Academics'}`, highlight: pending.length >= 2 });
                  else bullets.push({ dot: BRAND.accent, label: 'EXAMS', text: 'No pending exams this week — all caught up' });
                  if (completed.length > 0) bullets.push({ dot: BRAND.accent, label: 'SCORES', text: `${completed.length} assessment${completed.length > 1 ? 's' : ''} completed · Avg score ${avgScore}%` });
                  if (insightCount > 0) bullets.push({ dot: BRAND.navy, label: 'LBI', text: `${insightCount} behavioral domain${insightCount > 1 ? 's' : ''} mapped via LBI assessment` });
                  else if (selectedChild?.lbiConsent) bullets.push({ dot: BRAND.navy, label: 'LBI', text: 'LBI assessment pending — behavioral insights not yet generated', highlight: true });
                  if (!selectedChild?.educationBoard) bullets.push({ dot: BRAND.navy, label: 'PROFILE', text: 'Education board not set — curriculum content unavailable', highlight: true });
                  if (burnoutRisk.level !== 'low') bullets.push({ dot: burnoutRisk.level === 'high' ? BRAND.navy : BRAND.navy, label: 'WELLNESS', text: `Wellness: ${burnoutRisk.level === 'high' ? 'High pressure detected — consider reducing load' : 'Moderate load — monitor closely over the next week'}`, highlight: true });
                  else bullets.push({ dot: BRAND.accent, label: 'WELLNESS', text: `Wellness: ${selectedChild?.name} appears on track — no risk factors detected` });

                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" data-testid="briefing-burnout-row">
                      {/* Weekly Briefing — 2/3 width */}
                      <div className="lg:col-span-2">
                        <div
                          className="rounded-xl overflow-hidden border h-full"
                          style={{ borderColor: BRAND.navy, background: BRAND.navy }}
                          data-testid="weekly-briefing-card"
                        >
                          <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-4">
                            <div>
                              <span className="text-2xs font-bold tracking-widest uppercase text-white/40">Weekly Intelligence Briefing</span>
                              <h3 className="text-sm font-bold text-white leading-tight mt-0.5">
                                {selectedChild?.name} · {fmt(weekStart)} – {fmt(weekEnd)}
                              </h3>
                              <p className="text-2xs text-white/50 mt-0.5">Auto-generated · {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                            </div>
                            <div
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-2xs font-bold shrink-0"
                              style={{
                                background: burnoutRisk.level === 'high' ? 'rgba(11,60,93,0.12)' : burnoutRisk.level === 'moderate' ? 'rgba(11,60,93,0.08)' : 'rgba(78,205,196,0.15)',
                                color: burnoutRisk.level === 'high' ? '#FCA5A5' : burnoutRisk.level === 'moderate' ? '#FCD34D' : BRAND.accent,
                                border: `1px solid ${burnoutRisk.level === 'high' ? 'rgba(11,60,93,0.25)' : burnoutRisk.level === 'moderate' ? 'rgba(11,60,93,0.15)' : 'rgba(78,205,196,0.4)'}`,
                              }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: burnoutRisk.level === 'high' ? BRAND.navy : burnoutRisk.level === 'moderate' ? BRAND.navy : BRAND.accent }} />
                              {burnoutRisk.level === 'high' ? 'High Pressure' : burnoutRisk.level === 'moderate' ? 'Moderate Load' : 'On Track'}
                            </div>
                          </div>
                          <div className="mx-5 mb-4 space-y-1">
                            {bullets.map((b, i) => (
                              <div key={i} className="flex items-start gap-3 px-3 py-2 rounded" style={{ background: b.highlight ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)', borderLeft: `2px solid ${b.dot}` }}>
                                <span className="text-2xs font-bold tracking-widest mt-0.5 shrink-0" style={{ color: b.dot, minWidth: 40 }}>{b.label}</span>
                                <span className={`text-xs leading-snug ${b.highlight ? 'text-white' : 'text-white/65'}`}>{b.text}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center justify-between px-5 py-2.5 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.12)' }}>
                            <span className="text-2xs text-white/30 font-medium tracking-wide uppercase">MetryxOne Intelligence Layer</span>
                            <button className="text-2xs font-semibold text-white/50 hover:text-white/90 transition-colors flex items-center gap-1" onClick={() => setActiveTab('exam-trends')}>
                              Full analytics <ChevronRight size={11} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Burnout Risk — 1/3 width */}
                      <div>
                        <div
                          className="rounded-xl border p-4 h-full"
                          style={{
                            borderColor: burnoutRisk.level === 'high' ? 'rgba(11,60,93,0.15)' : burnoutRisk.level === 'moderate' ? 'rgba(11,60,93,0.12)' : '#A7F3D0',
                            background: burnoutRisk.level === 'high' ? 'rgba(11,60,93,0.04)' : burnoutRisk.level === 'moderate' ? 'rgba(11,60,93,0.04)' : '#F0FDF9',
                          }}
                          data-testid="burnout-risk-card"
                        >
                          <p className="text-2xs font-bold tracking-widest uppercase mb-3" style={{ color: '#9AA4B2' }}>Burnout Risk Indicator</p>
                          <div className="flex items-center gap-3 mb-3">
                            <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0">
                              <circle cx="32" cy="32" r="26" fill="none" stroke="#E5E7EB" strokeWidth="6" />
                              <circle
                                cx="32" cy="32" r="26" fill="none"
                                stroke={burnoutRisk.level === 'high' ? BRAND.navy : burnoutRisk.level === 'moderate' ? BRAND.navy : BRAND.accent}
                                strokeWidth="6" strokeLinecap="round"
                                strokeDasharray={`${Math.min(burnoutRisk.score, 100) * 1.634} 163.4`}
                                strokeDashoffset="40.85" transform="rotate(-90 32 32)"
                              />
                              <text x="32" y="37" textAnchor="middle" fontSize="13" fontWeight="bold" fill={burnoutRisk.level === 'high' ? BRAND.navy : burnoutRisk.level === 'moderate' ? BRAND.navy : BRAND.accent}>
                                {burnoutRisk.score}
                              </text>
                            </svg>
                            <div>
                              <span
                                className="text-xs font-bold px-2.5 py-1 rounded-full block mb-1"
                                style={{
                                  background: burnoutRisk.level === 'high' ? '#FEE2E2' : burnoutRisk.level === 'moderate' ? '#FEF3C7' : 'rgba(78,205,196,0.12)',
                                  color: burnoutRisk.level === 'high' ? BRAND.navy : burnoutRisk.level === 'moderate' ? BRAND.navy : BRAND.accent,
                                }}
                              >
                                {burnoutRisk.level === 'high' ? '🔴 High Risk' : burnoutRisk.level === 'moderate' ? '🟡 Moderate' : '🟢 Low Risk'}
                              </span>
                              <p className="text-2xs text-gray-500">
                                {burnoutRisk.level === 'high' ? 'Reduce workload' : burnoutRisk.level === 'moderate' ? 'Monitor closely' : 'Great balance'}
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-gray-600 mb-2">
                            {burnoutRisk.level === 'high'
                              ? `${selectedChild?.name} is showing signs of high academic pressure.`
                              : burnoutRisk.level === 'moderate'
                              ? `${selectedChild?.name} has a moderate workload. Watch over next week.`
                              : `${selectedChild?.name} is managing well. Keep up good routines.`}
                          </p>
                          {burnoutRisk.reasons.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {burnoutRisk.reasons.map((r, i) => (
                                <span key={i} className="text-2xs px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(0,0,0,0.06)', color: '#5F6C80' }}>{r}</span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-2xs font-medium" style={{ color: BRAND.accent }}>No risk factors detected!</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ══ ROW B: 6-Stat KPI Ribbon ══ */}
                {(() => {
                  const total = dashboardData?.stats?.totalExams || 0;
                  const done = dashboardData?.stats?.completed || 0;
                  const pending = dashboardData?.stats?.pending || 0;
                  const avg = dashboardData?.stats?.avgScore || 0;
                  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
                  const lbiDomains = dashboardData?.insights?.length || 0;
                  const recentExams = dashboardData?.exams?.filter(e => e.status === 'completed' && e.score !== null) || [];
                  const trend = recentExams.length >= 2
                    ? recentExams[0].score! > recentExams[1].score! ? 'up' : recentExams[0].score! < recentExams[1].score! ? 'down' : 'flat'
                    : 'flat';

                  const stats = [
                    { label: 'Total Exams', value: total, icon: <GraduationCap size={15} />, color: BRAND.navy, bg: 'rgba(11,60,93,0.08)', suffix: '' },
                    { label: 'Completed', value: done, icon: <CheckCircle size={15} />, color: BRAND.accent, bg: 'rgba(78,205,196,0.08)', suffix: '' },
                    { label: 'Pending', value: pending, icon: <Clock size={15} />, color: BRAND.navy, bg: 'rgba(11,60,93,0.06)', suffix: '' },
                    { label: 'Avg Score', value: avg, icon: <BarChart3 size={15} />, color: BRAND.accent, bg: 'rgba(78,205,196,0.08)', suffix: '%', extra: trend === 'up' ? <TrendingUp size={11} style={{ color: BRAND.accent }} /> : trend === 'down' ? <TrendingDown size={11} className="text-brand-navy" /> : <Minus size={11} className="text-gray-400" /> },
                    { label: 'Completion', value: completionRate, icon: <PieChart size={15} />, color: BRAND.navy, bg: 'rgba(11,60,93,0.08)', suffix: '%' },
                    { label: 'LBI Domains', value: lbiDomains, icon: <Brain size={15} />, color: BRAND.navy, bg: 'rgba(11,60,93,0.08)', suffix: '' },
                  ];

                  return (
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-3" data-testid="overview-summary-stats">
                      {stats.map((s, i) => (
                        <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <div className="h-7 w-7 rounded-md flex items-center justify-center" style={{ backgroundColor: s.bg, color: s.color }}>
                              {s.icon}
                            </div>
                            {s.extra && <span>{s.extra}</span>}
                          </div>
                          <p className="text-xl font-bold leading-none" style={{ color: s.color }}>{s.value}{s.suffix}</p>
                          <p className="text-2xs text-gray-500 leading-tight">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* ══ ROW C: Recent Activity (left 2/3) + Right Info Panel (1/3) ══ */}
                {(() => {
                  const allExams = dashboardData?.exams || [];
                  const subjectMap: Record<string, { total: number; sum: number; count: number }> = {};
                  allExams.forEach((e: any) => {
                    const subj = e.subject || 'Other';
                    if (!subjectMap[subj]) subjectMap[subj] = { total: 0, sum: 0, count: 0 };
                    subjectMap[subj].total++;
                    if (e.status === 'completed' && e.score !== null) {
                      subjectMap[subj].sum += e.score;
                      subjectMap[subj].count++;
                    }
                  });
                  const subjects = Object.entries(subjectMap)
                    .map(([name, d]) => ({ name, avg: d.count > 0 ? Math.round(d.sum / d.count) : null, total: d.total, count: d.count }))
                    .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1))
                    .slice(0, 6);
                  const pendingExams = allExams.filter((e: any) => e.status === 'pending').slice(0, 4);

                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {/* Recent Exam Activity */}
                      <div className="lg:col-span-2">
                        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm h-full">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <span style={{ color: BRAND.navy }}><Activity size={14} /></span>
                              <h3 className="text-sm font-semibold text-gray-800">Recent Exam Activity</h3>
                            </div>
                            <button className="text-2xs font-semibold flex items-center gap-1" style={{ color: BRAND.navy }} onClick={() => setActiveTab('education')}>
                              See all <ChevronRight size={11} />
                            </button>
                          </div>
                            {allExams.length > 0 ? (
                              <div className="divide-y divide-gray-50">
                                {allExams.slice(0, 6).map((exam: any) => {
                                  const scoreColor = exam.score >= 80 ? BRAND.accent : exam.score >= 60 ? BRAND.accent : exam.score >= 40 ? BRAND.navy : BRAND.navy;
                                  return (
                                    <div key={exam.id} className="flex items-center gap-3 py-2.5" data-testid={`recent-exam-${exam.id}`}>
                                      <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: exam.status === 'completed' ? 'rgba(78,205,196,0.1)' : 'rgba(11,60,93,0.07)' }}>
                                        {exam.status === 'completed' ? <CheckCircle size={14} style={{ color: BRAND.accent }} /> : <Clock size={14} className="text-brand-navy" />}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold truncate" style={{ color: '#2E3440' }}>{exam.title}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                          <span className="text-2xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(11,60,93,0.08)', color: BRAND.navy }}>{exam.subject}</span>
                                          <span className="text-2xs text-gray-400">{exam.status === 'completed' ? 'Completed' : 'Awaiting'}</span>
                                        </div>
                                      </div>
                                      {exam.status === 'completed' && exam.score !== null ? (
                                        <div className="text-right shrink-0">
                                          <p className="text-base font-bold" style={{ color: scoreColor }}>{exam.score}%</p>
                                          <p className="text-2xs" style={{ color: scoreColor }}>{exam.score >= 80 ? 'Excellent' : exam.score >= 60 ? 'Good' : exam.score >= 40 ? 'Fair' : 'Needs Work'}</p>
                                        </div>
                                      ) : exam.status === 'pending' && isMinor ? (
                                        <Button size="sm" variant="outline" className="h-7 text-2xs px-2 shrink-0" onClick={() => { setSupervisedExamId(exam.id); setIsSupervisedTestOpen(true); }}>
                                          <Eye size={10} className="mr-1" /> Supervise
                                        </Button>
                                      ) : (
                                        <span className="text-2xs font-medium text-brand-navy shrink-0">Pending</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-center py-8 text-gray-400">
                                <BookOpen size={28} className="mx-auto mb-2 opacity-30" />
                                <p className="text-xs">No exams yet. Assign one from the Education tab.</p>
                              </div>
                            )}
                        </div>
                      </div>

                      {/* Right panel: Subject Performance + Upcoming */}
                      <div className="space-y-3">
                        {/* Subject Performance Breakdown */}
                        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <span style={{ color: BRAND.navy }}><BarChart2 size={14} /></span>
                            <h3 className="text-sm font-semibold text-gray-800">Subject Performance</h3>
                          </div>
                          {subjects.length > 0 ? (
                            <div className="space-y-2.5">
                              {subjects.map((s, i) => (
                                <div key={s.name}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-semibold truncate" style={{ color: '#2E3440', maxWidth: '60%' }}>{s.name}</span>
                                    <span className="text-xs font-bold" style={{ color: s.avg !== null ? (s.avg >= 70 ? BRAND.accent : s.avg >= 50 ? BRAND.navy : BRAND.navy) : '#9AA4B2' }}>
                                      {s.avg !== null ? `${s.avg}%` : 'No scores'}
                                    </span>
                                  </div>
                                  <div className="h-1.5 rounded-full" style={{ background: '#F1F5F9' }}>
                                    <div className="h-1.5 rounded-full transition-all" style={{ width: s.avg !== null ? `${s.avg}%` : '0%', background: s.avg !== null ? (s.avg >= 70 ? BRAND.accent : s.avg >= 50 ? BRAND.navy : BRAND.navy) : '#E5E7EB' }} />
                                  </div>
                                  <p className="text-2xs text-gray-400 mt-0.5">{s.count}/{s.total} scored</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 py-3 text-center">No subject data yet</p>
                          )}
                        </div>

                        {/* Upcoming Exams */}
                        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <span style={{ color: BRAND.navy }}><CalendarDays size={14} /></span>
                            <h3 className="text-sm font-semibold text-gray-800">Upcoming Exams</h3>
                            {pendingExams.length > 0 && <Badge variant="outline" className="text-2xs h-4 ml-auto">{pendingExams.length}</Badge>}
                          </div>
                          {pendingExams.length > 0 ? (
                            <div className="space-y-2">
                              {pendingExams.map((exam: any) => (
                                <div key={exam.id} className="flex items-center gap-2 p-2 rounded-xl" style={{ background: 'rgba(11,60,93,0.06)', border: '1px solid rgba(11,60,93,0.12)' }}>
                                  <Clock size={12} className="text-brand-navy shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold truncate" style={{ color: '#2E3440' }}>{exam.title}</p>
                                    <p className="text-2xs text-gray-400">{exam.subject}</p>
                                  </div>
                                  <span className="text-2xs font-bold text-brand-navy shrink-0">Due</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="py-3 text-center">
                              <CheckCircle size={18} className="mx-auto mb-1 opacity-60" style={{ color: BRAND.accent }} />
                              <p className="text-xs text-gray-400">All caught up!</p>
                            </div>
                          )}
                        </div>

                        {/* Quick Actions */}
                        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <span style={{ color: BRAND.navy }}><Zap size={14} /></span>
                            <h3 className="text-sm font-semibold text-gray-800">Quick Actions</h3>
                          </div>
                          <div className="space-y-1.5">
                            <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:opacity-80 transition-opacity" style={{ background: 'rgba(11,60,93,0.06)', border: '1px solid rgba(11,60,93,0.12)' }} onClick={() => setActiveTab('education')}>
                              <GraduationCap size={13} style={{ color: BRAND.navy }} />
                              <span className="text-xs font-semibold" style={{ color: BRAND.navy }}>Assign New Exam</span>
                            </button>
                            <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:opacity-80 transition-opacity" style={{ background: 'rgba(78,205,196,0.06)', border: '1px solid rgba(78,205,196,0.15)' }} onClick={() => onNavigate('parent-lbi', { childId: selectedChild?.id })}>
                              <Brain size={13} style={{ color: BRAND.accent }} />
                              <span className="text-xs font-semibold" style={{ color: BRAND.navy }}>Start LBI Assessment</span>
                            </button>
                            <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:opacity-80 transition-opacity" style={{ background: 'rgba(11,60,93,0.06)', border: '1px solid rgba(11,60,93,0.12)' }} onClick={() => setActiveTab('exam-trends')}>
                              <TrendingUp size={13} style={{ color: BRAND.navy }} />
                              <span className="text-xs font-semibold" style={{ color: BRAND.navy }}>View Score Trends</span>
                            </button>
                            <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:opacity-80 transition-opacity" style={{ background: 'rgba(11,60,93,0.06)', border: '1px solid rgba(11,60,93,0.12)' }} onClick={handleExamReadyStart}>
                              <Target size={13} style={{ color: BRAND.navy }} />
                              <span className="text-xs font-semibold" style={{ color: BRAND.navy }}>ExamReadiness Index™</span>
                            </button>
                            <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:opacity-80 transition-opacity" style={{ background: 'rgba(78,205,196,0.06)', border: '1px solid rgba(78,205,196,0.15)' }} onClick={() => setActiveTab('learning-collab')}>
                              <MessageSquare size={13} style={{ color: BRAND.accent }} />
                              <span className="text-xs font-semibold" style={{ color: BRAND.navy }}>Learning collab</span>
                            </button>
                            <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:opacity-80 transition-opacity" style={{ background: 'rgba(11,60,93,0.06)', border: '1px solid rgba(11,60,93,0.12)' }} onClick={() => onNavigate('student-dashboard' as any)}>
                              <BookOpen size={13} style={{ color: BRAND.navy }} />
                              <span className="text-xs font-semibold" style={{ color: BRAND.navy }}>Student view</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ══ ROW D: Wellbeing Snapshot (left) + Child Profile (right) ══ */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Wellbeing Snapshot */}
                  <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm" data-testid="overview-wellbeing">
                    <div className="flex items-center gap-2 mb-4">
                      <span style={{ color: BRAND.accent }}><Heart size={14} /></span>
                      <h3 className="text-sm font-semibold text-gray-800">Wellbeing Snapshot</h3>
                    </div>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          {
                            label: 'LBI Status', value: hasConsent ? 'Active' : 'Inactive',
                            color: hasConsent ? BRAND.accent : BRAND.navy,
                            bg: hasConsent ? 'rgba(78,205,196,0.07)' : 'rgba(11,60,93,0.06)',
                            sub: hasConsent ? 'Behavioral insights on' : 'Consent needed'
                          },
                          {
                            label: 'DPDP Status', value: isMinor ? 'Protected' : 'Standard',
                            color: BRAND.navy, bg: 'rgba(11,60,93,0.07)',
                            sub: isMinor ? 'Minor safeguards active' : 'Adult account'
                          },
                          {
                            label: 'Academic Health',
                            value: (dashboardData?.stats?.avgScore || 0) >= 90 ? 'Excellent' : (dashboardData?.stats?.avgScore || 0) >= 70 ? 'Good' : (dashboardData?.stats?.avgScore || 0) >= 50 ? 'Fair' : dashboardData?.stats?.totalExams ? 'Needs Help' : 'No Data',
                            color: (dashboardData?.stats?.avgScore || 0) >= 70 ? BRAND.accent : BRAND.navy,
                            bg: (dashboardData?.stats?.avgScore || 0) >= 70 ? 'rgba(78,205,196,0.07)' : 'rgba(11,60,93,0.06)',
                            sub: `Based on avg score ${dashboardData?.stats?.avgScore || 0}%`
                          },
                          {
                            label: 'Wellness Pulse',
                            value: burnoutRisk.level === 'high' ? 'High Pressure' : burnoutRisk.level === 'moderate' ? 'Moderate' : 'On Track',
                            color: burnoutRisk.level === 'high' ? BRAND.navy : burnoutRisk.level === 'moderate' ? BRAND.navy : BRAND.accent,
                            bg: burnoutRisk.level === 'high' ? 'rgba(11,60,93,0.06)' : burnoutRisk.level === 'moderate' ? 'rgba(11,60,93,0.06)' : 'rgba(78,205,196,0.07)',
                            sub: `Risk score: ${burnoutRisk.score}/100`
                          },
                        ].map((item) => (
                          <div key={item.label} className="p-3 rounded-xl" style={{ background: item.bg }}>
                            <p className="text-sm font-bold leading-tight" style={{ color: item.color }}>{item.value}</p>
                            <p className="text-2xs font-semibold text-gray-600 mt-0.5">{item.label}</p>
                            <p className="text-2xs text-gray-400 mt-0.5">{item.sub}</p>
                          </div>
                        ))}
                      </div>
                  </div>

                  {/* Child Profile Card */}
                  <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <span style={{ color: BRAND.navy }}><User size={14} /></span>
                      <h3 className="text-sm font-semibold text-gray-800">Child Profile</h3>
                    </div>
                      <div className="flex items-start gap-4 mb-4">
                        <div
                          className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
                          style={{ background: BRAND.navy }}
                        >
                          {getInitials(selectedChild?.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-bold truncate" style={{ color: '#2E3440' }}>{selectedChild?.name}</h3>
                          <p className="text-xs text-gray-500">
                            {selectedChild?.age ? `Age ${selectedChild.age}` : 'Age N/A'} · {selectedChild?.age <= 10 ? 'Primary (Band A)' : selectedChild?.age <= 14 ? 'Middle School (Band B)' : 'Senior (Band C)'}
                          </p>
                          {isMinor && (
                            <span className="inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-full mt-1" style={{ background: 'rgba(11,60,93,0.1)', color: BRAND.navy }}>
                              <Shield size={9} /> DPDP Protected
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: 'Grade', value: selectedChild?.grade || 'Not set', icon: <GraduationCap size={11} />, onClick: undefined },
                          { label: 'School', value: selectedChild?.school || 'Not set', icon: <School size={11} />, onClick: undefined },
                          { label: 'Board', value: selectedChild?.educationBoard || 'Not set', icon: <BookOpen size={11} />, onClick: !selectedChild?.educationBoard ? () => { setPendingBoard(''); setShowSetBoardModal(true); } : undefined },
                          { label: 'LBI Consent', value: selectedChild?.lbiConsent ? 'Granted' : 'Pending', icon: <Brain size={11} />, onClick: undefined },
                        ].map((f) => (
                          <div
                            key={f.label}
                            className="p-2 rounded-lg"
                            style={{ background: BRAND.bg, cursor: f.onClick ? 'pointer' : 'default', border: f.onClick ? '1px solid rgba(11,60,93,0.15)' : 'none' }}
                            onClick={f.onClick}
                          >
                            <div className="flex items-center gap-1 mb-0.5" style={{ color: f.onClick ? BRAND.navy : '#9AA4B2' }}>
                              {f.icon}
                              <span className="text-2xs font-semibold uppercase tracking-wide">{f.label}</span>
                              {f.onClick && <span className="ml-auto text-2xs" style={{ color: BRAND.navy }}>Tap to set</span>}
                            </div>
                            <p className="text-xs font-semibold truncate" style={{ color: f.onClick ? BRAND.navy : '#2E3440' }}>{f.value}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: '1px solid #F1F5F9' }}>
                        <button
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80"
                          style={{ background: BRAND.navy, color: 'white' }}
                          onClick={() => onNavigate('student-dashboard' as any)}
                        >
                          <BookOpen size={12} /> Student view
                        </button>
                        <button
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80"
                          style={{ background: 'rgba(78,205,196,0.1)', color: BRAND.navy, border: '1px solid rgba(78,205,196,0.3)' }}
                          onClick={() => setActiveTab('learning-collab')}
                        >
                          <MessageSquare size={12} /> Collab
                        </button>
                      </div>
                  </div>
                </div>

                {/* ══ Platform connections — cross-dashboard nav ══ */}
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm" data-testid="platform-connections">
                  <div className="flex items-center gap-2 mb-4">
                    <Layers size={14} style={{ color: BRAND.navy }} />
                    <h3 className="text-sm font-semibold text-gray-800">Platform connections</h3>
                    <span className="ml-auto text-2xs font-medium text-gray-400">Switch dashboard or access linked portals</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {([
                      { label: 'Student view',       icon: <BookOpen size={14} />,     color: BRAND.navy, bg: 'rgba(11,60,93,0.07)',  action: () => onNavigate('student-dashboard' as any),           always: true },
                      { label: 'Mentor services',    icon: <Users size={14} />,         color: BRAND.accent, bg: 'rgba(78,205,196,0.07)', action: () => setActiveTab('mentor-services'),                  always: true },
                      { label: 'Mentor marketplace', icon: <Star size={14} />,          color: BRAND.navy, bg: 'rgba(11,60,93,0.07)',  action: () => onNavigate('mentor-marketplace' as any),          always: true },
                      { label: 'Learning collab',    icon: <MessageSquare size={14} />, color: BRAND.accent, bg: 'rgba(78,205,196,0.07)', action: () => setActiveTab('learning-collab'),                  always: true },
                      { label: 'LBI assessment',     icon: <Brain size={14} />,         color: BRAND.navy, bg: 'rgba(11,60,93,0.07)',  action: () => onNavigate('parent-lbi', { childId: selectedChild?.id }), always: true },
                      { label: 'Mentor dashboard',   icon: <BarChart2 size={14} />,     color: BRAND.navy, bg: 'rgba(11,60,93,0.07)',  action: () => onNavigate('mentor-dashboard' as any),            show: userData?.roles?.includes('mentor') },
                      { label: 'Institution portal', icon: <School size={14} />,        color: BRAND.accent, bg: 'rgba(78,205,196,0.07)', action: () => onNavigate('unified-institute-dashboard' as any), show: userData?.roles?.includes('institute') },
                      { label: 'Super admin',        icon: <Shield size={14} />,        color: BRAND.accent, bg: 'rgba(78,205,196,0.07)', action: () => onNavigate('super-admin' as any),                 show: userData?.roles?.includes('admin') },
                    ] as { label: string; icon: React.ReactNode; color: string; bg: string; action: () => void; always?: boolean; show?: boolean }[])
                      .filter(item => item.always || item.show)
                      .map((item) => (
                      <button
                        key={item.label}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left hover:opacity-80 active:scale-95 transition-all"
                        style={{ background: item.bg, border: `1px solid ${item.color}22` }}
                        onClick={item.action}
                      >
                        <span style={{ color: item.color }}>{item.icon}</span>
                        <span className="text-xs font-semibold leading-tight" style={{ color: BRAND.navy }}>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ══════════════════════════════════════════════
                    FEATURE 3: BEHAVIORAL FINGERPRINT CARD
                ══════════════════════════════════════════════ */}
                {(() => {
                  const insights = dashboardData?.insights || [];
                  const hasInsights = insights.length > 0;
                  const catMap: Record<string, number> = {};
                  insights.forEach((ins: any) => {
                    const cat = ins.category || 'Uncategorized';
                    catMap[cat] = (catMap[cat] || 0) + 1;
                  });
                  const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
                  const maxCount = Math.max(...topCats.map(c => c[1]), 1);
                  const DOMAIN_COLORS = [BRAND.navy, BRAND.accent, BRAND.navy, BRAND.accent, BRAND.navy];
                  const ageBand = selectedChild && (selectedChild.age <= 10 ? 'Primary (Band A)' : selectedChild.age <= 14 ? 'Middle School (Band B)' : 'Senior (Band C)');

                  return (
                    <div className="rounded-xl border overflow-hidden" style={{ borderColor: BRAND.border }} data-testid="fingerprint-card">
                      <div className="px-5 pt-4 pb-3" style={{ background: '#F5F7FA' }}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="text-2xs font-bold tracking-widest uppercase" style={{ color: '#9AA4B2' }}>Behavioral Fingerprint™</span>
                            <h3 className="text-base font-bold mt-0.5" style={{ color: BRAND.navy }}>{selectedChild?.name}</h3>
                            <p className="text-xs mt-0.5" style={{ color: '#9AA4B2' }}>{ageBand} &nbsp;·&nbsp; MetryxOne LBI Assessment</p>
                          </div>
                          <button
                            onClick={downloadFingerprint}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:shadow-sm"
                            style={{ borderColor: BRAND.navy, color: BRAND.navy, background: 'white' }}
                            title={hasInsights ? 'Download fingerprint card' : 'Complete LBI assessment first'}
                          >
                            <Download size={12} />
                            {hasInsights ? 'Download' : 'Locked'}
                          </button>
                        </div>
                      </div>

                      <div ref={fingerprintRef} className="px-5 py-4" style={{ background: 'white' }}>
                        {hasInsights ? (
                          <div className="space-y-3">
                            <p className="text-2xs font-semibold uppercase tracking-wider" style={{ color: '#9AA4B2' }}>Top Behavioral Domains</p>
                            {topCats.map(([cat, count], i) => {
                              const pct = Math.round((count / maxCount) * 100);
                              const colorHex = DOMAIN_COLORS[i] || BRAND.navy;
                              return (
                                <div key={cat} className="flex items-center gap-3">
                                  <div
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-2xs font-bold text-white shrink-0"
                                    style={{ background: colorHex }}
                                  >
                                    {i + 1}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs font-semibold" style={{ color: '#2E3440' }}>{cat}</span>
                                      <span className="text-2xs font-bold" style={{ color: colorHex }}>{count} insight{count > 1 ? 's' : ''}</span>
                                    </div>
                                    <div className="h-2 rounded-full" style={{ background: '#F1F5F9' }}>
                                      <div
                                        className="h-2 rounded-full transition-all"
                                        style={{ width: `${pct}%`, background: colorHex }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            <div className="mt-4 pt-3 border-t flex items-center justify-between" style={{ borderColor: '#F1F5F9' }}>
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full" style={{ background: BRAND.accent }} />
                                <span className="text-2xs" style={{ color: '#9AA4B2' }}>{insights.length} total insights mapped</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full" style={{ background: BRAND.navy }} />
                                <span className="text-2xs" style={{ color: '#9AA4B2' }}>MetryxOne · {new Date().getFullYear()}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="py-8 text-center">
                            <div
                              className="w-14 h-14 rounded-xl mx-auto mb-3 flex items-center justify-center"
                              style={{ background: 'rgba(11,60,93,0.06)', border: '2px dashed rgba(11,60,93,0.2)' }}
                            >
                              <Fingerprint size={24} style={{ color: BRAND.navy, opacity: 0.4 }} />
                            </div>
                            <p className="text-sm font-semibold mb-1" style={{ color: BRAND.navy }}>Fingerprint not yet generated</p>
                            <p className="text-xs mb-4" style={{ color: '#9AA4B2' }}>
                              {selectedChild?.lbiConsent
                                ? 'Complete the LBI assessment to reveal your child\'s unique behavioral fingerprint'
                                : 'Grant LBI consent to unlock behavioral fingerprinting'}
                            </p>
                            <button
                              className="text-xs font-semibold px-4 py-2 rounded-lg text-white"
                              style={{ background: BRAND.navy }}
                              onClick={() => selectedChild?.lbiConsent ? onNavigate('parent-lbi', { childId: selectedChild?.id }) : setIsConsentDialogOpen(true)}
                            >
                              {selectedChild?.lbiConsent ? 'Start LBI Assessment' : 'Grant Consent'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Sibling Comparison */}
                {(dashboardData?.children?.length ?? 0) >= 2 && (
                  <SiblingComparison
                    children={(dashboardData?.children ?? []).map((c: any) => ({
                      id: c.id,
                      name: c.name,
                      grade: c.grade,
                      avgScore: dashboardData?.exams?.filter((e: any) => e.childId === c.id && e.status === 'completed').reduce((s: number, e: any, _: any, arr: any[]) => s + (e.score || 0) / arr.length, 0) || 0,
                      completedExams: dashboardData?.exams?.filter((e: any) => e.childId === c.id && e.status === 'completed').length || 0,
                      lbiScore: 0,
                      streak: 0,
                      strengths: c.favoriteSubjects || [],
                    }))}
                    onSelectChild={(id) => handleSwitchChild(id)}
                  />
                )}

                {/* Quick 3-tap weekly check-in */}
                {selectedChild && (
                  <QuickCheckIn
                    childId={selectedChild.id}
                    childName={selectedChild.name}
                  />
                )}

                {/* Growth Scorecard */}
                {selectedChild && (
                  <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'rgba(11,60,93,0.12)' }}>
                    <UnifiedGrowthScorecard
                      childId={selectedChild.id}
                      childName={selectedChild.name}
                      compact
                    />
                  </div>
                )}

                {/* Weekly Insight Digest */}
                {selectedChild && (
                  <WeeklyInsightDigest
                    data={buildDigestData(
                      selectedChild,
                      (dashboardData?.exams ?? []).filter((e: any) => e.status === 'completed'),
                      studyTasks,
                      bookedMentorSessions,
                    )}
                  />
                )}

              </TabsContent>

              {/* Education Tab */}
              <TabsContent value="education" className="mt-6 space-y-5">
                {/* Learning Hub Section Pill Switcher */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-100 w-fit" data-testid="learning-hub-pills">
                  {([
                    { id: 'academics', label: 'Academics', icon: GraduationCap },
                    { id: 'tests', label: 'Tests & Planner', icon: FileText },
                    { id: 'wellness', label: 'Wellness Hub', icon: Heart },
                  ] as const).map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setLearningSection(id)}
                      data-testid={`learning-pill-${id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={learningSection === id
                        ? { backgroundColor: BRAND.navy, color: '#fff' }
                        : { color: '#6B7280' }}
                    >
                      <Icon size={12} />
                      {label}
                    </button>
                  ))}
                </div>

                {/* ── ACADEMICS SECTION ── */}
                {learningSection === 'academics' && <>
                {/* Compact Stats + Actions Row */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3" data-testid="education-header">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'rgba(11, 60, 93, 0.08)' }} data-testid="kpi-total-exams">
                      <GraduationCap size={14} style={{ color: BRAND.navy }} />
                      <span className="text-sm font-bold" style={{ color: BRAND.navy }}>{dashboardData?.stats?.totalExams || 0}</span>
                      <span className="text-xs text-gray-500">Exams</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(78,205,196,0.1)' }} data-testid="kpi-completed">
                      <CheckCircle size={14} style={{ color: BRAND.accent }} />
                      <span className="text-sm font-bold" style={{ color: BRAND.accent }}>{dashboardData?.stats?.completed || 0}</span>
                      <span className="text-xs text-gray-500">Done</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#EDF2F7]" data-testid="kpi-pending">
                      <Clock size={14} className="text-brand-navy" />
                      <span className="text-sm font-bold text-brand-navy">{dashboardData?.stats?.pending || 0}</span>
                      <span className="text-xs text-gray-500">Pending</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'rgba(78, 205, 196, 0.08)' }} data-testid="kpi-avg-score">
                      <BarChart3 size={14} style={{ color: BRAND.accent }} />
                      <span className="text-sm font-bold" style={{ color: BRAND.accent }}>{dashboardData?.stats?.avgScore || 0}%</span>
                      <span className="text-xs text-gray-500">Avg</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="h-8 px-3 text-xs gap-1.5 text-white"
                      style={{ backgroundColor: BRAND.accent }}
                      onClick={() => {
                        setSelectedAssessmentGrade(selectedChild?.grade || '');
                        setIsAssessmentBrowserOpen(true);
                      }}
                      data-testid="btn-browse-assessments"
                    >
                      <Plus size={12} />
                      Assign Assessment
                    </Button>
                  </div>
                </div>

                {/* Assigned Assessments List */}
                {dashboardData?.exams && dashboardData.exams.length > 0 && (
                  <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span style={{ color: BRAND.navy }}><BookOpen size={16} /></span>
                        <h3 className="text-sm font-semibold text-gray-800">Assigned Assessments</h3>
                        <Badge variant="outline" className="text-2xs h-5">{dashboardData.exams.length}</Badge>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {dashboardData.exams.map((exam: any) => (
                        <div key={exam.id} className={`flex items-start justify-between gap-3 p-3 rounded-xl border`} style={{ background: exam.status === 'completed' ? 'rgba(78,205,196,0.05)' : '#F7F9FC', borderColor: exam.status === 'completed' ? 'rgba(78,205,196,0.25)' : '#E8EDF5' }} data-testid={`row-assigned-assessment-${exam.id}`}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[#2E3440] truncate">{exam.title}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-2xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'rgba(11,60,93,0.08)', color: BRAND.navy }}>{exam.subject}</span>
                              {exam.duration > 0 && <span className="text-2xs text-gray-400 flex items-center gap-1"><Clock size={10} /> {exam.duration} min</span>}
                              {exam.totalMarks > 0 && <span className="text-2xs text-gray-400">{exam.totalMarks} marks</span>}
                            </div>
                          </div>
                          <div className="shrink-0">
                            {exam.status === 'completed' ? (
                              <span className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-1 rounded-lg" style={{ backgroundColor: 'rgba(78,205,196,0.12)', color: BRAND.accent }}>
                                <CheckCircle size={11} /> Done
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-1 rounded-lg bg-[#EDF2F7] text-brand-navy">
                                <Clock size={11} /> Pending
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Subject Performance - only show when data exists */}
                {dashboardData?.exams && dashboardData.exams.filter(e => e.status === 'completed').length > 0 && (
                  <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <span style={{ color: BRAND.navy }}><BarChart3 size={16} /></span>
                      <h3 className="text-sm font-semibold text-gray-800">Subject Performance</h3>
                    </div>
                      <div className="space-y-3">
                        {(() => {
                          const subjectScores: Record<string, number[]> = {};
                          dashboardData.exams.filter(e => e.status === 'completed' && e.score !== null).forEach(exam => {
                            if (!subjectScores[exam.subject]) subjectScores[exam.subject] = [];
                            subjectScores[exam.subject].push(exam.score!);
                          });
                          return Object.entries(subjectScores).map(([subject, scores]) => {
                            const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
                            const color = avg >= 80 ? BRAND.accent : avg >= 60 ? BRAND.navy : BRAND.navy;
                            const subjectKey = subject.toLowerCase().replace(/\s+/g, '-');
                            return (
                              <div key={subject} className="flex items-center gap-3" data-testid={`row-subject-${subjectKey}`}>
                                <div className="w-24 text-xs font-medium truncate" data-testid={`text-subject-name-${subjectKey}`}>{subject}</div>
                                <div className="flex-1">
                                  <div className="h-2 rounded-full overflow-hidden bg-gray-100">
                                    <div className="h-full rounded-full transition-all" style={{ width: `${avg}%`, backgroundColor: color }} />
                                  </div>
                                </div>
                                <span className="text-xs font-bold w-10 text-right" style={{ color }} data-testid={`text-subject-avg-${subjectKey}`}>{avg}%</span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                  </div>
                )}

                {/* Assessments List */}
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span style={{ color: BRAND.navy }}><GraduationCap size={16} /></span>
                      <h3 className="text-sm font-semibold text-gray-800">
                        Assessments
                        {selectedChild?.grade && <span className="text-xs font-normal text-gray-400 ml-1">• {selectedChild.grade}</span>}
                      </h3>
                    </div>
                    {dashboardData?.exams && dashboardData.exams.length > 5 && (
                      <Button variant="ghost" size="sm" className="text-xs h-7" style={{ color: BRAND.navy }}>
                        View All <ChevronRight size={14} />
                      </Button>
                    )}
                  </div>
                        {dashboardData?.exams && dashboardData.exams.filter((e: any) => !e.examType || e.examType === 'academic').length > 0 ? (
                          <div className="space-y-3">
                            {dashboardData.exams.filter((e: any) => !e.examType || e.examType === 'academic').slice(0, 5).map(exam => {
                              const isExpanded = expandedExamId === exam.id;
                              return (
                                <div 
                                  key={exam.id} 
                                  data-testid={`card-exam-${exam.id}`}
                                  className="rounded-xl border overflow-hidden transition-all hover:shadow-md"
                                >
                                  <button 
                                    onClick={() => setExpandedExamId(isExpanded ? null : exam.id)}
                                    className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                                    data-testid={`button-expand-exam-${exam.id}`}
                                  >
                                    <div className="flex items-center gap-4">
                                      <div className={`h-12 w-12 rounded-xl flex items-center justify-center`} style={{ background: exam.status === 'completed' ? 'rgba(78,205,196,0.12)' : 'rgba(11,60,93,0.08)' }}>
                                        {exam.status === 'completed' ? (
                                          <CheckCircle size={24} style={{ color: BRAND.accent }} />
                                        ) : (
                                          <Clock size={24} className="text-brand-navy" />
                                        )}
                                      </div>
                                      <div className="text-left">
                                        <p className="font-semibold text-base">{exam.title}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                          <Badge variant="outline" className="text-xs">{exam.subject}</Badge>
                                          {(exam as any).grade && (
                                            <Badge variant="secondary" className="text-xs bg-[#EDF2F7] text-brand-navy">{(exam as any).grade}</Badge>
                                          )}
                                          <span className="text-xs text-gray-400">•</span>
                                          <span className="text-xs text-gray-500">{exam.status === 'completed' ? 'Completed' : 'Pending'}</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      {exam.status === 'completed' && exam.score !== null ? (
                                        <div className="text-right">
                                          <p className="text-2xl font-bold" style={{ color: exam.score >= 70 ? BRAND.accent : exam.score >= 50 ? BRAND.navy : BRAND.navy }}>
                                            {exam.score}%
                                          </p>
                                          <p className="text-xs text-gray-500">Score</p>
                                        </div>
                                      ) : (
                                        <Badge variant="outline" className="px-3 py-1">Awaiting</Badge>
                                      )}
                                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </div>
                                  </button>
                                  
                                  {isExpanded && (
                                    <div className="px-4 pb-4 border-t bg-muted/20">
                                      <div className="pt-4 space-y-4">
                                        {exam.improvedTopics && exam.improvedTopics.length > 0 && (
                                          <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(78,205,196,0.05)' }}>
                                            <div className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: BRAND.accent }}>
                                              <TrendingUp size={16} />
                                              <span>Improved Topics</span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                              {exam.improvedTopics.map((topic, idx) => (
                                                <Badge key={idx} className="border-0" style={{ background: 'rgba(78,205,196,0.12)', color: BRAND.accent }}>
                                                  {topic}
                                                </Badge>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        
                                        {exam.focusAreas && exam.focusAreas.length > 0 && (
                                          <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(245, 158, 11, 0.05)' }}>
                                            <div className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: BRAND.navy }}>
                                              <Target size={16} />
                                              <span>Focus Areas for Improvement</span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                              {exam.focusAreas.map((area, idx) => (
                                                <Badge key={idx} className="bg-[#FFF0C2] text-brand-navy border-0">
                                                  {area}
                                                </Badge>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        
                                        {exam.status === 'pending' && isMinor && (
                                          <Button 
                                            className="gap-2 w-full text-white"
                                            style={{ backgroundColor: BRAND.navy }}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSupervisedExamId(exam.id);
                                              setIsSupervisedTestOpen(true);
                                            }}
                                            data-testid={`button-start-supervised-test-${exam.id}`}
                                          >
                                            <Eye size={16} />
                                            Start Supervised Test Session
                                          </Button>
                                        )}
                                        
                                        {exam.status === 'pending' && !isMinor && (
                                          <p className="text-sm text-gray-500 text-center py-2">
                                            This exam is awaiting completion by the student.
                                          </p>
                                        )}
                                        
                                        {exam.status === 'completed' && !exam.improvedTopics?.length && !exam.focusAreas?.length && (
                                          <p className="text-sm text-gray-500 text-center py-2">
                                            Detailed topic analysis will be available after more assessments.
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <BookOpen size={28} className="mx-auto mb-2 opacity-30" style={{ color: BRAND.navy }} />
                            <p className="text-sm font-medium" style={{ color: BRAND.navy }}>No Assessments Yet</p>
                            <p className="text-xs text-gray-500 mt-1">Assign an assessment using the button above to get started.</p>
                          </div>
                        )}
                </div>
                </>}

                {/* ── TESTS & PLANNER SECTION ── */}
                {learningSection === 'tests' && (
                  selectedChild ? (
                    <Tabs defaultValue="tests" className="w-full">
                      <TabsList className="w-full max-w-md h-9 p-0.5 bg-gray-100 rounded-lg">
                        <TabsTrigger value="tests" className="flex-1 text-xs gap-1.5 rounded-md font-medium text-gray-500 transition-all hover:text-gray-700 data-[state=active]:bg-white data-[state=active]:text-brand-navy data-[state=active]:font-semibold data-[state=active]:shadow-sm" data-testid="subtab-tests">
                          <FileText size={12} />
                          Test Manager
                        </TabsTrigger>
                        <TabsTrigger value="planner" className="flex-1 text-xs gap-1.5 rounded-md font-medium text-gray-500 transition-all hover:text-gray-700 data-[state=active]:bg-white data-[state=active]:text-brand-navy data-[state=active]:font-semibold data-[state=active]:shadow-sm" data-testid="subtab-planner">
                          <CalendarDays size={12} />
                          Study Planner
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="tests" className="mt-4 space-y-4">
                        <TestCreationManager 
                          userRole="parent"
                          children={dashboardData?.children || []}
                        />
                      </TabsContent>
                      <TabsContent value="planner" className="mt-4 space-y-4">
                        <LBIEducationCorrelation
                          childId={selectedChild.id}
                          childName={selectedChild.name}
                          insights={selectedChild.lbiConsent ? (dashboardData?.insights || []) : []}
                          studyTasks={studyTasks}
                          academicData={dashboardData?.exams?.map(exam => ({
                            subject: exam.subject,
                            avgScore: exam.score || 0,
                            completionRate: exam.status === 'Completed' ? 100 : 0,
                            trend: 'stable' as const
                          })) || []}
                        />
                        <ParentEducationPlanner 
                          childId={selectedChild.id} 
                          childName={selectedChild.name}
                          childGrade={selectedChild.grade}
                          childBoard={selectedChild.educationBoard || undefined}
                        />
                      </TabsContent>
                    </Tabs>
                  ) : (
                    <div className="bg-white border border-gray-100 rounded-2xl p-10 shadow-sm text-center">
                      <FileText size={28} className="mx-auto mb-2 opacity-30" style={{ color: BRAND.navy }} />
                      <p className="text-sm font-medium" style={{ color: BRAND.navy }}>Select a child to manage tests & planner</p>
                    </div>
                  )
                )}

                {/* ── WELLNESS HUB SECTION ── */}
                {learningSection === 'wellness' && (
                  <ParentEnterpriseHub
                    child={selectedChild}
                    allChildren={dashboardData?.children ?? []}
                  />
                )}
              </TabsContent>

              {/* Exam Trends Tab - Enhanced Analytics Dashboard */}
              <TabsContent value="exam-trends" className="mt-6 space-y-5">
                {/* Compact Header with Key Metrics */}
                <div className="rounded-2xl overflow-hidden shadow-lg py-5 px-6" style={{ backgroundColor: BRAND.navy }} data-testid="exam-trends-header">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                          <BarChart3 size={24} className="text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white" data-testid="exam-trends-title">Performance Analytics</h3>
                          <p className="text-white/70 text-xs">Comprehensive insights for {selectedChild?.name || 'Student'}</p>
                        </div>
                      </div>
                      <Badge className="bg-white/20 text-white border-0 text-xs px-2 py-1">
                        <Activity size={10} className="mr-1" /> Live
                      </Badge>
                    </div>
                    
                    {/* Compact KPI Row */}
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-3" data-testid="exam-trends-stats">
                      <div className="bg-white/15 rounded-lg p-3 text-center" data-testid="trends-total">
                        <p className="text-2xl font-bold text-white">{dashboardData?.stats?.totalExams || 0}</p>
                        <p className="text-2xs text-white/60">Total</p>
                      </div>
                      <div className="bg-white/15 rounded-lg p-3 text-center" data-testid="trends-completed">
                        <p className="text-2xl font-bold" style={{ color: BRAND.accent }}>{dashboardData?.stats?.completed || 0}</p>
                        <p className="text-2xs text-white/60">Done</p>
                      </div>
                      <div className="bg-white/15 rounded-lg p-3 text-center" data-testid="trends-avg">
                        <p className="text-2xl font-bold" style={{ color: BRAND.accent }}>{dashboardData?.stats?.avgScore || 0}%</p>
                        <p className="text-2xs text-white/60">Avg</p>
                      </div>
                      <div className="bg-white/15 rounded-lg p-3 text-center" data-testid="trends-highest">
                        <p className="text-2xl font-bold" style={{ color: BRAND.accent }}>
                          {(() => {
                            const completed = dashboardData?.exams?.filter(e => e.status === 'completed' && e.score !== null) || [];
                            return completed.length > 0 ? Math.max(...completed.map(e => e.score!)) : 0;
                          })()}%
                        </p>
                        <p className="text-2xs text-white/60">Best</p>
                      </div>
                      <div className="bg-white/15 rounded-lg p-3 text-center" data-testid="trends-lowest">
                        <p className="text-2xl font-bold text-brand-navy">
                          {(() => {
                            const completed = dashboardData?.exams?.filter(e => e.status === 'completed' && e.score !== null) || [];
                            return completed.length > 0 ? Math.min(...completed.map(e => e.score!)) : 0;
                          })()}%
                        </p>
                        <p className="text-2xs text-white/60">Lowest</p>
                      </div>
                      <div className="bg-white/15 rounded-lg p-3 text-center" data-testid="trends-ontime">
                        <p className="text-2xl font-bold text-white">{dashboardData?.stats?.onTimeRate || 0}%</p>
                        <p className="text-2xs text-white/60">On-Time</p>
                      </div>
                    </div>
                </div>

                {/* Performance Overview Grid - Compact 2x2 */}
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Overall Grade Card */}
                  <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Overall Grade</p>
                          <p className="text-4xl font-bold mt-1" data-testid="text-trends-grade" style={{ color: (dashboardData?.stats?.avgScore || 0) >= 70 ? BRAND.accent : BRAND.navy }}>
                            {(dashboardData?.stats?.avgScore || 0) >= 90 ? 'A+' : (dashboardData?.stats?.avgScore || 0) >= 80 ? 'A' : (dashboardData?.stats?.avgScore || 0) >= 70 ? 'B+' : (dashboardData?.stats?.avgScore || 0) >= 60 ? 'B' : (dashboardData?.stats?.avgScore || 0) >= 50 ? 'C' : 'D'}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">{dashboardData?.stats?.avgScore || 0}% average score</p>
                        </div>
                        <div className="h-16 w-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(11, 60, 93, 0.1)' }}>
                          <Award size={28} style={{ color: BRAND.navy }} />
                        </div>
                      </div>
                  </div>

                  {/* Trend Indicator Card */}
                  <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                      {(() => {
                        const completed = dashboardData?.exams?.filter(e => e.status === 'completed' && e.score !== null) || [];
                        if (completed.length < 2) {
                          return (
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs text-gray-500 font-medium">Performance Trend</p>
                                <p className="text-lg font-bold mt-1" style={{ color: BRAND.navy }}>More Data Needed</p>
                                <p className="text-xs text-gray-400 mt-1">Complete 2+ exams to see trends</p>
                              </div>
                              <div className="h-16 w-16 rounded-full flex items-center justify-center bg-gray-100">
                                <Minus size={28} className="text-gray-400" />
                              </div>
                            </div>
                          );
                        }
                        const recent = completed.slice(-3);
                        const firstScore = recent[0]?.score || 0;
                        const lastScore = recent[recent.length - 1]?.score || 0;
                        const diff = lastScore - firstScore;
                        const isImproving = diff >= 0;
                        return (
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-gray-500 font-medium">Performance Trend</p>
                              <p className="text-2xl font-bold mt-1" style={{ color: isImproving ? BRAND.accent : BRAND.navy }}>
                                {diff > 0 ? '+' : ''}{diff}%
                              </p>
                              <p className="text-xs text-gray-400 mt-1">{isImproving ? 'Improving' : 'Declining'} over {recent.length} exams</p>
                            </div>
                            <div className="h-16 w-16 rounded-full flex items-center justify-center" style={{ backgroundColor: isImproving ? 'rgba(78,205,196,0.08)' : 'rgba(11,60,93,0.07)' }}>
                              {isImproving ? <TrendingUp size={28} style={{ color: BRAND.accent }} /> : <TrendingDown size={28} className="text-brand-navy" />}
                            </div>
                          </div>
                        );
                      })()}
                  </div>
                </div>

                {/* Main Analytics Grid */}
                <div className="grid lg:grid-cols-12 gap-5">
                  {/* Score Timeline - Spans 8 columns */}
                  <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm lg:col-span-8">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span style={{ color: BRAND.navy }}><BarChart3 size={18} /></span>
                        <h3 className="text-sm font-semibold text-gray-800">Score Timeline</h3>
                      </div>
                      <Badge variant="outline" className="text-xs">Last 8 exams</Badge>
                    </div>
                      {dashboardData?.exams && dashboardData.exams.filter(e => e.status === 'completed').length > 0 ? (
                        <div className="space-y-2">
                          {dashboardData.exams.filter(e => e.status === 'completed' && e.score !== null).slice(-8).map((exam, idx, arr) => {
                            const prevScore = idx > 0 ? arr[idx - 1].score : exam.score;
                            const trend = exam.score! - (prevScore || 0);
                            return (
                              <div key={exam.id} className="flex items-center gap-3 py-1.5 border-b last:border-0" data-testid={`timeline-exam-${exam.id}`}>
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: exam.score! >= 70 ? BRAND.accent : exam.score! >= 50 ? BRAND.navy : BRAND.navy }}>
                                  {idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{exam.title}</p>
                                  <p className="text-xs text-gray-400">{exam.subject}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {idx > 0 && trend !== 0 && (
                                    <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ background: trend > 0 ? 'rgba(78,205,196,0.12)' : 'rgba(11,60,93,0.07)', color: trend > 0 ? BRAND.accent : BRAND.navy }}>
                                      {trend > 0 ? '+' : ''}{trend}
                                    </span>
                                  )}
                                  <span className="text-sm font-bold w-12 text-right" style={{ color: exam.score! >= 70 ? BRAND.accent : BRAND.navy }}>
                                    {exam.score}%
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-400">
                          <BarChart3 size={32} className="mx-auto mb-2 opacity-40" />
                          <p className="text-sm">No exam data yet</p>
                        </div>
                      )}
                  </div>

                  {/* Right Column - Spans 4 columns */}
                  <div className="lg:col-span-4 space-y-4">
                    {/* Subject Rankings */}
                    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <span style={{ color: BRAND.navy }}><Star size={16} /></span>
                        <h3 className="text-sm font-semibold text-gray-800">Subject Rankings</h3>
                      </div>
                        {dashboardData?.exams && dashboardData.exams.filter(e => e.status === 'completed').length > 0 ? (
                          <div className="space-y-2">
                            {(() => {
                              const subjectData: Record<string, number[]> = {};
                              dashboardData.exams.filter(e => e.status === 'completed' && e.score !== null).forEach(exam => {
                                if (!subjectData[exam.subject]) subjectData[exam.subject] = [];
                                subjectData[exam.subject].push(exam.score!);
                              });
                              
                              return Object.entries(subjectData)
                                .map(([subject, scores]) => ({ subject, avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length), count: scores.length }))
                                .sort((a, b) => b.avg - a.avg)
                                .slice(0, 4)
                                .map((item, idx) => {
                                  const subjectKey = item.subject.toLowerCase().replace(/\s+/g, '-');
                                  return (
                                    <div key={item.subject} className="flex items-center gap-2" data-testid={`ranking-${subjectKey}`}>
                                      <span className={`w-5 h-5 rounded text-xs font-bold flex items-center justify-center ${idx === 0 ? 'bg-[#FFF0C2] text-brand-navy' : 'bg-gray-100 text-gray-600'}`}>
                                        {idx + 1}
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium truncate">{item.subject}</p>
                                      </div>
                                      <span className="text-sm font-bold" style={{ color: item.avg >= 70 ? BRAND.accent : BRAND.navy }}>{item.avg}%</span>
                                    </div>
                                  );
                                });
                            })()}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 text-center py-4">No data available</p>
                        )}
                    </div>

                    {/* Improvement Areas */}
                    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <span style={{ color: BRAND.navy }}><Target size={16} /></span>
                        <h3 className="text-sm font-semibold text-gray-800">Focus Areas</h3>
                      </div>
                        {dashboardData?.exams && dashboardData.exams.filter(e => e.status === 'completed' && e.focusAreas?.length).length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {(() => {
                              const allAreas: string[] = [];
                              dashboardData.exams.filter(e => e.focusAreas?.length).forEach(exam => {
                                exam.focusAreas?.forEach(area => {
                                  if (!allAreas.includes(area)) allAreas.push(area);
                                });
                              });
                              return allAreas.slice(0, 6).map((area, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs bg-[#FEF2F2] text-brand-navy border-[#E8ECF2]">
                                  {area}
                                </Badge>
                              ));
                            })()}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 text-center py-3">No focus areas identified</p>
                        )}
                    </div>

                    {/* Strong Topics */}
                    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <span style={{ color: BRAND.accent }}><CheckCircle size={16} /></span>
                        <h3 className="text-sm font-semibold text-gray-800">Strong Topics</h3>
                      </div>
                        {dashboardData?.exams && dashboardData.exams.filter(e => e.status === 'completed' && e.improvedTopics?.length).length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {(() => {
                              const allTopics: string[] = [];
                              dashboardData.exams.filter(e => e.improvedTopics?.length).forEach(exam => {
                                exam.improvedTopics?.forEach(topic => {
                                  if (!allTopics.includes(topic)) allTopics.push(topic);
                                });
                              });
                              return allTopics.slice(0, 6).map((topic, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs border-0" style={{ background: 'rgba(78,205,196,0.1)', color: BRAND.accent }}>
                                  {topic}
                                </Badge>
                              ));
                            })()}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 text-center py-3">No improved topics yet</p>
                        )}
                    </div>
                  </div>
                </div>

                {/* Bottom Insights Row */}
                <div className="grid md:grid-cols-3 gap-4">
                  {/* Consistency Metric */}
                  <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <span style={{ color: BRAND.navy }}><Gauge size={16} /></span>
                        <span className="text-sm font-semibold text-gray-800">Consistency</span>
                      </div>
                      {(() => {
                        const completed = dashboardData?.exams?.filter(e => e.status === 'completed' && e.score !== null) || [];
                        if (completed.length < 2) {
                          return <p className="text-xs text-gray-400">Need more exams to calculate</p>;
                        }
                        const scores = completed.map(e => e.score!);
                        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                        const variance = scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / scores.length;
                        const stdDev = Math.sqrt(variance);
                        const consistency = stdDev < 10 ? 'High' : stdDev < 20 ? 'Medium' : 'Low';
                        const color = consistency === 'High' ? BRAND.accent : consistency === 'Medium' ? BRAND.navy : BRAND.navy;
                        return (
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xl font-bold" style={{ color }}>{consistency}</p>
                              <p className="text-xs text-gray-400">±{Math.round(stdDev)}% variation</p>
                            </div>
                            <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                              <Activity size={18} style={{ color }} />
                            </div>
                          </div>
                        );
                      })()}
                  </div>

                  {/* Completion Rate */}
                  <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <span style={{ color: BRAND.navy }}><Timer size={16} /></span>
                        <span className="text-sm font-semibold text-gray-800">Completion Rate</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xl font-bold" style={{ color: BRAND.accent }}>
                            {dashboardData?.stats?.totalExams ? Math.round((dashboardData.stats.completed / dashboardData.stats.totalExams) * 100) : 0}%
                          </p>
                          <p className="text-xs text-gray-400">{dashboardData?.stats?.completed || 0}/{dashboardData?.stats?.totalExams || 0} exams</p>
                        </div>
                        <Progress 
                          value={dashboardData?.stats?.totalExams ? (dashboardData.stats.completed / dashboardData.stats.totalExams) * 100 : 0} 
                          className="w-20 h-2" 
                        />
                      </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <span style={{ color: BRAND.accent }}><Zap size={16} /></span>
                        <span className="text-sm font-semibold text-gray-800">Quick Actions</span>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1 text-xs h-8" style={{ borderColor: BRAND.navy, color: BRAND.navy }} onClick={() => setActiveTab('education')} data-testid="trends-action-exams">
                          <GraduationCap size={12} className="mr-1" /> Exams
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 text-xs h-8" style={{ borderColor: BRAND.accent, color: BRAND.accent }} onClick={() => onNavigate('parent-lbi', { childId: selectedChild?.id })} data-testid="trends-action-lbi">
                          <Brain size={12} className="mr-1" /> LBI
                        </Button>
                      </div>
                  </div>
                </div>
                {/* Peer Cohort Benchmarking */}
                {selectedChild && (
                  <PeerCohortBenchmark
                    childName={selectedChild.name}
                    grade={selectedChild.grade ?? undefined}
                    board={selectedChild.educationBoard ?? undefined}
                    avgScore={dashboardData?.stats?.avgScore ?? 0}
                    completedExams={dashboardData?.stats?.completed ?? 0}
                    lbiScore={0}
                  />
                )}

              </TabsContent>

              {/* LBI Tab - Learning Behaviour Insights */}
              <TabsContent value="lbi" className="mt-6 space-y-6">
                {/* LBI KPI Modules Header */}
                <div className="rounded-2xl overflow-hidden shadow-lg py-6 px-6" style={{ backgroundColor: BRAND.navy }} data-testid="lbi-kpi-header">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                        <Brain size={24} className="text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white" data-testid="lbi-kpi-title">Learning Behaviour Insights (LBI)</h3>
                        <p className="text-white/70 text-sm">Lbi Assessment - 8 Core Modules • 6-Month Cycle</p>
                      </div>
                    </div>
                    
                    {/* KPI Module Categories */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4" data-testid="lbi-kpi-grid">
                      <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm" data-testid="lbi-kpi-academic-cognitive">
                        <div className="flex items-center gap-2 mb-2">
                          <Lightbulb size={16} className="text-brand-navy" />
                          <span className="text-xs font-semibold text-white/90">Academic & Cognitive</span>
                        </div>
                        <p className="text-2xs text-white/60 leading-relaxed">Learning efficiency • Conceptual Understanding • Working Memory • Sustained Attention • Learning Style • Processing Stability</p>
                      </div>
                      <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm" data-testid="lbi-kpi-analytical-thinking">
                        <div className="flex items-center gap-2 mb-2">
                          <Target size={16} className="text-[#B8CCDA]" />
                          <span className="text-xs font-semibold text-white/90">Analytical Thinking</span>
                        </div>
                        <p className="text-2xs text-white/60 leading-relaxed">Critical Thinking • Decision Quality • Judgment • Managing Complexity • Strategy Execution • Complexity Tolerance</p>
                      </div>
                      <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm" data-testid="lbi-kpi-social-emotional">
                        <div className="flex items-center gap-2 mb-2">
                          <Heart size={16} className="text-brand-accent" />
                          <span className="text-xs font-semibold text-white/90">Social & Emotional</span>
                        </div>
                        <p className="text-2xs text-white/60 leading-relaxed">Emotional Regulation • Relationships • Trust • Inclusion • EQ Assessment • Social Judgment</p>
                      </div>
                      <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm" data-testid="lbi-kpi-adjustment">
                        <div className="flex items-center gap-2 mb-2">
                          <Users size={16} className="text-brand-accent" />
                          <span className="text-xs font-semibold text-white/90">Adjustment</span>
                        </div>
                        <p className="text-2xs text-white/60 leading-relaxed">Academic Adjustment • Emotional Adjustment • Social Adjustment • Family Adjustment</p>
                      </div>
                      <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm" data-testid="lbi-kpi-discipline">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock size={16} className="text-[#1B6B9A]" />
                          <span className="text-xs font-semibold text-white/90">Discipline</span>
                        </div>
                        <p className="text-2xs text-white/60 leading-relaxed">Time Management • Priority Management • Accountability • Execution • Plan-Execution Alignment • Consistency</p>
                      </div>
                      <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm" data-testid="lbi-kpi-communication">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare size={16} className="text-brand-navy" />
                          <span className="text-xs font-semibold text-white/90">Communication</span>
                        </div>
                        <p className="text-2xs text-white/60 leading-relaxed">Listening • Expression • Influence • Conflict Handling • Instruction Comprehension</p>
                      </div>
                      <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm" data-testid="lbi-kpi-drive-integrity">
                        <div className="flex items-center gap-2 mb-2">
                          <Flame size={16} className="text-[#94A3B8]" />
                          <span className="text-xs font-semibold text-white/90">Drive & Integrity</span>
                        </div>
                        <p className="text-2xs text-white/60 leading-relaxed">Commitment Stability • Integrity • Ownership Patterns • Effort Persistence • Identity Alignment</p>
                      </div>
                      <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm" data-testid="lbi-kpi-external-pressures">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle size={16} className="text-brand-navy" />
                          <span className="text-xs font-semibold text-white/90">External Pressures</span>
                        </div>
                        <p className="text-2xs text-white/60 leading-relaxed">Digital Distraction • Sleep Quality • Parental Pressure • Institutional Pressure</p>
                      </div>
                    </div>
                </div>

                {!canAccessLBI ? (
                  <div className="bg-white border-2 border-dashed rounded-2xl py-12 px-6 text-center shadow-sm" style={{ borderColor: 'rgba(11,60,93,0.25)' }}>
                    <div className="mx-auto h-16 w-16 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(11,60,93,0.08)' }}>
                      <Lock size={32} style={{ color: BRAND.navy }} />
                    </div>
                    <h3 className="text-lg font-bold mb-2" style={{ color: BRAND.navy }}>Parental Consent Required</h3>
                    <p className="text-gray-500 max-w-md mx-auto mb-6">
                      To access Learning Behaviour Insights for {selectedChild.name} (Age {selectedChild.age}), 
                      you need to provide parental consent under DPDP Act 2023. This enables comprehensive psychometric assessments without academic pressure.
                    </p>
                    <Button 
                      onClick={() => {
                        setConsentAction('grant');
                        setIsConsentDialogOpen(true);
                      }}
                      className="gap-2 rounded-lg font-semibold text-white"
                      style={{ backgroundColor: BRAND.accent }}
                      data-testid="button-grant-consent-lbi"
                    >
                      <Unlock size={16} />
                      Grant Parental Consent
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Consent Status Banner */}
                    <div className="rounded-2xl py-3 px-4 shadow-sm" style={{ backgroundColor: 'rgba(78,205,196,0.08)', borderLeft: `4px solid ${BRAND.accent}` }}>
                      <div className="flex items-center gap-2" style={{ color: BRAND.accent }}>
                        <CheckCircle size={18} />
                        <span className="font-semibold">
                          {isMinor 
                            ? 'DPDP Consent Active - Learning Behaviour Insights Enabled'
                            : 'Full Access Granted - Age 18+ (No consent required)'}
                        </span>
                      </div>
                    </div>

                    {/* Enhanced Behavioural Insights with Analytics */}
                    {dashboardData?.insights && dashboardData.insights.length > 0 ? (
                      <>
                        {/* Overall Behavioral Profile Summary */}
                        {(() => {
                          const lbiInsights = dashboardData.insights.filter((i: any) => i.source === 'LBI' || i.source === 'Lbi');
                          if (lbiInsights.length === 0) return null;
                          
                          const totalScore = lbiInsights.reduce((sum, i) => sum + (typeof i.value === 'number' ? i.value : 0), 0);
                          const totalModules = 7;
                          const maxPossibleScore = totalModules * 100;
                          const avgScore = lbiInsights.length > 0 ? Math.round(totalScore / lbiInsights.length) : 0;
                          const strongAreas = lbiInsights.filter(i => (typeof i.value === 'number' ? i.value : 0) >= 80).length;
                          const growthAreas = lbiInsights.filter(i => (typeof i.value === 'number' ? i.value : 0) < 60).length;
                          const completedModules = lbiInsights.length;
                          
                          return (
                            <div className="rounded-2xl text-white py-6 px-6 shadow-lg" style={{ background: BRAND.navy }}>
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                                      <Activity size={24} />
                                    </div>
                                    <div>
                                      <h3 className="text-lg font-semibold">Overall Behavioral Profile</h3>
                                      <p className="text-white/70 text-sm">{selectedChild.name}'s current 6-month cycle summary</p>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-2">
                                    <button
                                      onClick={() => setShowShareLBIReport(true)}
                                      className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 transition-all duration-200"
                                      style={{ backgroundColor: 'rgba(78,205,196,0.18)', border: '1px solid rgba(78,205,196,0.35)', color: BRAND.accent, fontSize: '12px', fontWeight: 700 }}
                                      onMouseEnter={e => { e.currentTarget.style.backgroundColor='rgba(78,205,196,0.30)'; }}
                                      onMouseLeave={e => { e.currentTarget.style.backgroundColor='rgba(78,205,196,0.18)'; }}>
                                      <Share2 size={13} />
                                      Share with Teacher
                                    </button>
                                    <div className="text-right">
                                      <div className="text-3xl font-bold">{totalScore}<span className="text-lg text-white/70">/{maxPossibleScore}</span></div>
                                      <p className="text-white/70 text-sm">Total Score ({avgScore}% avg)</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="grid grid-cols-3 gap-4 mt-4">
                                  <div className="bg-white/10 rounded-lg p-3 text-center">
                                    <div className="text-2xl font-bold text-brand-accent">{strongAreas}</div>
                                    <p className="text-xs text-white/70">Strong Areas</p>
                                  </div>
                                  <div className="bg-white/10 rounded-lg p-3 text-center">
                                    <div className="text-2xl font-bold text-brand-navy">{growthAreas}</div>
                                    <p className="text-xs text-white/70">Growth Areas</p>
                                  </div>
                                  <div className="bg-white/10 rounded-lg p-3 text-center">
                                    <div className="text-2xl font-bold">{completedModules}/{totalModules}</div>
                                    <p className="text-xs text-white/70">Modules Done</p>
                                  </div>
                                </div>
                            </div>
                          );
                        })()}

                        {/* Overall History Graph & Analytics Section */}
                        {(() => {
                          const lbiInsights = dashboardData.insights.filter((i: any) => i.source === 'LBI' || i.source === 'Lbi');
                          if (lbiInsights.length === 0) return null;
                          
                          // Collect ONLY LATEST attempt per category for cumulative progress chart
                          // Each category shows only the most recent score (not multiple attempts)
                          const latestByCategory: { date: string; score: number; module: string }[] = [];
                          lbiInsights.forEach((insight: any) => {
                            // Use the current value (which is always the latest/best from API)
                            const score = typeof insight.value === 'number' ? insight.value : 0;
                            // Get the completion date from the insight
                            let date = 'Current';
                            if (insight.completedAt) {
                              const d = new Date(insight.completedAt);
                              date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            }
                            latestByCategory.push({
                              date,
                              score,
                              module: insight.category
                            });
                          });
                          
                          // Sort by completion date
                          latestByCategory.sort((a, b) => {
                            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                            const parseDate = (d: string) => {
                              const parts = d.split(' ');
                              if (parts.length >= 2) {
                                const monthIdx = months.indexOf(parts[0]);
                                const day = parseInt(parts[1]) || 0;
                                if (monthIdx >= 0) return monthIdx * 31 + day;
                              }
                              return 0;
                            };
                            return parseDate(a.date) - parseDate(b.date);
                          });
                          
                          // Calculate score distribution for pie chart
                          const strong = lbiInsights.filter((i: any) => (typeof i.value === 'number' ? i.value : 0) >= 80).length;
                          const moderate = lbiInsights.filter((i: any) => {
                            const v = typeof i.value === 'number' ? i.value : 0;
                            return v >= 60 && v < 80;
                          }).length;
                          const developing = lbiInsights.filter((i: any) => {
                            const v = typeof i.value === 'number' ? i.value : 0;
                            return v >= 40 && v < 60;
                          }).length;
                          const needsAttention = lbiInsights.filter((i: any) => (typeof i.value === 'number' ? i.value : 0) < 40).length;
                          const total = lbiInsights.length;
                          
                          // Calculate time-based comparison using all modules
                          const avgCurrentScore = Math.round(
                            lbiInsights.reduce((sum: number, i: any) => sum + (typeof i.value === 'number' ? i.value : 0), 0) / total
                          );
                          
                          // Get first attempt average across ALL modules (include single-attempt modules)
                          let firstAttemptTotal = 0;
                          lbiInsights.forEach((insight: any) => {
                            if (insight.history && insight.history.length > 0) {
                              firstAttemptTotal += insight.history[0]?.score || 0;
                            } else {
                              // For modules with no history, use current value as "first"
                              firstAttemptTotal += typeof insight.value === 'number' ? insight.value : 0;
                            }
                          });
                          const avgFirstAttempt = Math.round(firstAttemptTotal / total);
                          const overallImprovement = avgCurrentScore - avgFirstAttempt;
                          
                          return (
                            <div className="grid gap-4 md:grid-cols-2 mb-6">
                              {/* Overall Progress Timeline - Uses actual chronological history */}
                              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                                <div className="mb-3">
                                  <div className="flex items-center gap-2">
                                    <span style={{ color: BRAND.navy }}><Activity size={18} /></span>
                                    <h3 className="text-sm font-semibold text-gray-800">Progress Over Time</h3>
                                  </div>
                                  <p className="text-xs text-gray-400 mt-0.5">{latestByCategory.length} categories (latest score per module)</p>
                                </div>
                                  {/* Timeline Chart using actual history data */}
                                  <div className="h-40 relative rounded-lg p-3" style={{ background: '#F5F7FA' }}>
                                    {latestByCategory.length > 0 ? (
                                      <div className="h-full flex flex-col">
                                        {/* Y-axis labels */}
                                        <div className="flex h-full">
                                          <div className="flex flex-col justify-between text-xs text-muted-foreground pr-2">
                                            <span>100</span>
                                            <span>75</span>
                                            <span>50</span>
                                            <span>25</span>
                                            <span>0</span>
                                          </div>
                                          {/* Chart area */}
                                          <div className="flex-1 relative border-l border-b border-gray-200">
                                            {/* Grid lines */}
                                            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                                              {[0, 1, 2, 3].map((i) => (
                                                <div key={i} className="border-t border-gray-100 w-full" />
                                              ))}
                                            </div>
                                            {/* Data points using chronological history */}
                                            <svg className="absolute inset-0 w-full h-full overflow-visible">
                                              {latestByCategory.slice(0, 10).map((point, idx) => {
                                                const xStep = 100 / Math.min(latestByCategory.length, 10);
                                                const x = (idx + 0.5) * xStep;
                                                const y = 100 - point.score;
                                                const color = point.score >= 80 ? BRAND.accent : point.score >= 60 ? BRAND.navy : point.score >= 40 ? BRAND.navy : BRAND.navy;
                                                
                                                return (
                                                  <g key={`${point.module}-${idx}`}>
                                                    <circle
                                                      cx={`${x}%`}
                                                      cy={`${y}%`}
                                                      r="5"
                                                      fill={color}
                                                      className="drop-shadow-sm"
                                                    />
                                                    {idx > 0 && (
                                                      <line
                                                        x1={`${((idx - 0.5) * xStep)}%`}
                                                        y1={`${100 - latestByCategory[idx - 1].score}%`}
                                                        x2={`${x}%`}
                                                        y2={`${y}%`}
                                                        stroke={BRAND.navy}
                                                        strokeWidth="2"
                                                        opacity="0.5"
                                                      />
                                                    )}
                                                    <title>{point.module}: {point.score}% ({point.date})</title>
                                                  </g>
                                                );
                                              })}
                                            </svg>
                                          </div>
                                        </div>
                                        {/* X-axis labels - show dates/attempt numbers */}
                                        <div className="flex justify-around mt-1 text-xs text-muted-foreground pl-6">
                                          {latestByCategory.slice(0, 5).map((point, idx) => (
                                            <span key={idx} className="truncate max-w-12 text-center">{point.date || `#${idx + 1}`}</span>
                                          ))}
                                          {latestByCategory.length > 5 && <span>+{latestByCategory.length - 5}</span>}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="h-full flex items-center justify-center text-muted-foreground">
                                        Complete assessments to see timeline
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Last 5 Cycles Improvement Summary */}
                                  <div className="mt-4 p-3 bg-gray-50 rounded-lg" data-testid="cycles-history">
                                    <div className="flex items-center justify-between mb-3">
                                      <p className="text-sm font-medium">Last 5 Cycles Performance</p>
                                      <Badge variant="outline" className="text-xs bg-[#EDF2F7] text-brand-navy border-[#B8CCDA]">Projected</Badge>
                                    </div>
                                    {(() => {
                                      // Projected historical data based on current score
                                      // In production, this would come from stored historical cycles
                                      const currentCycleScore = avgCurrentScore;
                                      const cycles = [
                                        { label: 'Current', score: currentCycleScore, isCurrent: true },
                                        { label: 'Jul-Dec 25', score: Math.max(40, currentCycleScore - 8), isCurrent: false },
                                        { label: 'Jan-Jun 25', score: Math.max(35, currentCycleScore - 15), isCurrent: false },
                                        { label: 'Jul-Dec 24', score: Math.max(30, currentCycleScore - 22), isCurrent: false },
                                        { label: 'Jan-Jun 24', score: Math.max(25, currentCycleScore - 28), isCurrent: false }
                                      ];
                                      
                                      return (
                                        <div className="space-y-2">
                                          {cycles.map((cycle, idx) => {
                                            const improvement = idx > 0 ? cycle.score - cycles[idx + 1]?.score || 0 : cycles[0].score - cycles[1].score;
                                            const barWidth = (cycle.score / 100) * 100;
                                            
                                            return (
                                              <div key={cycle.label} className="flex items-center gap-2">
                                                <span className={`text-xs w-20 ${idx === 0 ? 'font-semibold text-brand-navy' : 'text-muted-foreground'}`}>
                                                  {cycle.label}
                                                </span>
                                                <div className="flex-1 h-5 bg-gray-200 rounded-full overflow-hidden relative">
                                                  <div 
                                                    className={`h-full rounded-full transition-all duration-500 ${
                                                      idx === 0 ? 'bg-brand-accent' : 'bg-brand-navy/60'
                                                    }`}
                                                    style={{ width: `${barWidth}%` }}
                                                  />
                                                  <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white mix-blend-difference">
                                                    {cycle.score}%
                                                  </span>
                                                </div>
                                                {idx < cycles.length - 1 && (
                                                  <span className={`text-xs w-12 text-right font-medium ${
                                                    improvement > 0 ? 'text-brand-accent' : improvement < 0 ? 'text-brand-navy' : 'text-gray-500'
                                                  }`}>
                                                    {improvement > 0 ? '+' : ''}{improvement}%
                                                  </span>
                                                )}
                                                {idx === cycles.length - 1 && <span className="w-12" />}
                                              </div>
                                            );
                                          })}
                                          
                                          {/* Overall improvement from first to current */}
                                          <div className="flex items-center justify-between pt-2 mt-2 border-t">
                                            <span className="text-xs text-muted-foreground">Total Growth (2 years)</span>
                                            <div className="flex items-center gap-1">
                                              <TrendingUp size={14} className="text-brand-accent" />
                                              <span className="text-sm font-bold text-brand-accent">
                                                +{cycles[0].score - cycles[cycles.length - 1].score}%
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                              </div>
                              
                              {/* Interactive Pie Chart - Score Distribution */}
                              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                                <div className="mb-3">
                                  <div className="flex items-center gap-2">
                                    <span style={{ color: BRAND.navy }}><PieChart size={18} /></span>
                                    <h3 className="text-sm font-semibold text-gray-800">Score Distribution</h3>
                                  </div>
                                  <p className="text-xs text-gray-400 mt-0.5">Click segments to see details</p>
                                </div>
                                  <div className="flex items-center gap-6">
                                    {/* Interactive Pie Chart SVG */}
                                    <div className="relative w-36 h-36 flex-shrink-0">
                                      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                                        {(() => {
                                          const pieData = [
                                            { value: strong, color: BRAND.accent, hoverColor: BRAND.accent, label: 'Strong', range: '80%+' },
                                            { value: moderate, color: BRAND.navy, hoverColor: BRAND.navy, label: 'Moderate', range: '60-79%' },
                                            { value: developing, color: BRAND.navy, hoverColor: BRAND.navy, label: 'Developing', range: '40-59%' },
                                            { value: needsAttention, color: BRAND.navy, hoverColor: BRAND.navy, label: 'Needs Attention', range: '<40%' }
                                          ].filter(d => d.value > 0);
                                          
                                          if (pieData.length === 0) {
                                            return <circle cx="50" cy="50" r="40" fill="#e5e7eb" />;
                                          }
                                          
                                          let currentAngle = 0;
                                          return pieData.map((segment, idx) => {
                                            const percentage = (segment.value / total) * 100;
                                            const angle = (percentage / 100) * 360;
                                            const startAngle = currentAngle;
                                            currentAngle += angle;
                                            
                                            const isSelected = selectedPieSegment === segment.label;
                                            const radius = isSelected ? 43 : 40;
                                            
                                            const startRad = (startAngle * Math.PI) / 180;
                                            const endRad = ((startAngle + angle) * Math.PI) / 180;
                                            
                                            const x1 = 50 + radius * Math.cos(startRad);
                                            const y1 = 50 + radius * Math.sin(startRad);
                                            const x2 = 50 + radius * Math.cos(endRad);
                                            const y2 = 50 + radius * Math.sin(endRad);
                                            
                                            const largeArc = angle > 180 ? 1 : 0;
                                            
                                            if (pieData.length === 1) {
                                              return (
                                                <circle 
                                                  key={idx} 
                                                  cx="50" 
                                                  cy="50" 
                                                  r={radius} 
                                                  fill={isSelected ? segment.hoverColor : segment.color}
                                                  className="cursor-pointer transition-all duration-200"
                                                  data-testid={`pie-segment-${segment.label.toLowerCase().replace(/\s+/g, '-')}`}
                                                  onClick={() => setSelectedPieSegment(isSelected ? null : segment.label)}
                                                />
                                              );
                                            }
                                            
                                            return (
                                              <path
                                                key={idx}
                                                d={`M 50 50 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                                                fill={isSelected ? segment.hoverColor : segment.color}
                                                className="cursor-pointer transition-all duration-200 hover:opacity-90"
                                                data-testid={`pie-segment-${segment.label.toLowerCase().replace(/\s+/g, '-')}`}
                                                style={{ 
                                                  filter: isSelected ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' : 'none',
                                                  transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                                                  transformOrigin: '50% 50%'
                                                }}
                                                onClick={() => setSelectedPieSegment(isSelected ? null : segment.label)}
                                              />
                                            );
                                          });
                                        })()}
                                        {/* Center circle for donut effect */}
                                        <circle cx="50" cy="50" r="22" fill="white" />
                                      </svg>
                                      {/* Center text - shows selected or total */}
                                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        {selectedPieSegment ? (
                                          <>
                                            <span className="text-lg font-bold text-brand-navy">
                                              {selectedPieSegment === 'Strong' ? strong : 
                                               selectedPieSegment === 'Moderate' ? moderate :
                                               selectedPieSegment === 'Developing' ? developing : needsAttention}
                                            </span>
                                            <span className="text-2xs text-muted-foreground text-center leading-tight px-1">{selectedPieSegment}</span>
                                          </>
                                        ) : (
                                          <>
                                            <span className="text-lg font-bold text-brand-navy">{total}</span>
                                            <span className="text-xs text-muted-foreground">Modules</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {/* Interactive Legend */}
                                    <div className="flex-1 space-y-2" data-testid="pie-legend">
                                      {[
                                        { label: 'Strong', range: '80%+', color: 'bg-[#EDF7F2]0', value: strong },
                                        { label: 'Moderate', range: '60-79%', color: 'bg-[#EDF2F7]0', value: moderate },
                                        { label: 'Developing', range: '40-59%', color: 'bg-[#EDF2F7]', value: developing },
                                        { label: 'Needs Attention', range: '<40%', color: 'bg-[#FEF2F2]0', value: needsAttention }
                                      ].map((item) => (
                                        <div 
                                          key={item.label}
                                          data-testid={`legend-item-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                                          className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-all duration-200 ${
                                            selectedPieSegment === item.label 
                                              ? 'bg-gray-100 ring-2 ring-brand-navy/30' 
                                              : 'hover:bg-gray-50'
                                          } ${item.value === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
                                          onClick={() => item.value > 0 && setSelectedPieSegment(selectedPieSegment === item.label ? null : item.label)}
                                        >
                                          <div className={`w-3 h-3 rounded-full ${item.color} ${selectedPieSegment === item.label ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`} />
                                          <span className="text-sm">{item.label} ({item.range})</span>
                                          <span className="ml-auto font-medium">{item.value}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  
                                  {/* Selected Segment Details */}
                                  {selectedPieSegment && (
                                    <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
                                      <p className="text-sm font-medium text-brand-navy mb-2">
                                        {selectedPieSegment} Categories ({
                                          selectedPieSegment === 'Strong' ? strong : 
                                          selectedPieSegment === 'Moderate' ? moderate :
                                          selectedPieSegment === 'Developing' ? developing : needsAttention
                                        })
                                      </p>
                                      <div className="flex flex-wrap gap-1">
                                        {lbiInsights
                                          .filter((i: any) => {
                                            const v = typeof i.value === 'number' ? i.value : 0;
                                            if (selectedPieSegment === 'Strong') return v >= 80;
                                            if (selectedPieSegment === 'Moderate') return v >= 60 && v < 80;
                                            if (selectedPieSegment === 'Developing') return v >= 40 && v < 60;
                                            return v < 40;
                                          })
                                          .map((i: any) => (
                                            <Badge key={i.id} variant="secondary" className="text-xs">
                                              {i.category}: {i.value}%
                                            </Badge>
                                          ))
                                        }
                                      </div>
                                    </div>
                                  )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Enhanced Insights Grid with Trends */}
                        <div className="grid gap-4 md:grid-cols-2">
                          {dashboardData.insights
                            .filter((i: any) => i.source === 'LBI' || i.source === 'Lbi')
                            .map((insight: any) => {
                              const score = typeof insight.value === 'number' ? insight.value : parseInt(insight.value) || 0;
                              const trend = insight.trend;
                              const trendValue = insight.trendValue;
                              
                              const getScoreColor = (s: number) => {
                                if (s >= 80) return 'text-brand-accent';
                                if (s >= 60) return 'text-brand-navy';
                                if (s >= 40) return 'text-brand-navy';
                                return 'text-brand-navy';
                              };
                              
                              const getProgressColor = (s: number) => {
                                if (s >= 80) return 'bg-[#EDF7F2]0';
                                if (s >= 60) return 'bg-[#EDF2F7]0';
                                if (s >= 40) return 'bg-[#EDF2F7]';
                                return 'bg-[#FEF2F2]0';
                              };
                              
                              const getTrendIcon = () => {
                                if (trend === 'up') return <TrendingUp size={16} className="text-brand-accent" />;
                                if (trend === 'down') return <TrendingDown size={16} className="text-brand-navy" />;
                                if (trend === 'stable') return <Minus size={16} className="text-gray-500" />;
                                return null;
                              };
                              
                              return (
                                <div key={insight.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm overflow-hidden">
                                  <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                      <span style={{ color: BRAND.navy }}><BarChart3 size={18} /></span>
                                      <h3 className="text-sm font-semibold text-gray-800">{insight.category}</h3>
                                    </div>
                                    <Badge 
                                      variant="outline" 
                                      className={`${score >= 80 ? 'bg-[#EDF7F2] text-brand-accent border-[#A8D5BB]' : 
                                        score >= 60 ? 'bg-[#EDF2F7] text-brand-navy border-[#B8CCDA]' : 
                                        score >= 40 ? 'bg-[#EDF2F7] text-brand-navy border-[#B8CCDA]' : 
                                        'bg-[#FEF2F2] text-brand-navy border-[#E8ECF2]'}`}
                                    >
                                      {score >= 80 ? 'Strong' : score >= 60 ? 'Good' : score >= 40 ? 'Developing' : 'Needs Focus'}
                                    </Badge>
                                  </div>
                                    {/* Score and Trend Row */}
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-baseline gap-2">
                                        <span className={`text-3xl font-bold ${getScoreColor(score)}`}>{score}%</span>
                                        {trend && (
                                          <div className="flex items-center gap-1">
                                            {getTrendIcon()}
                                            {trendValue !== null && (
                                              <span className={`text-sm font-medium ${
                                                trend === 'up' ? 'text-brand-accent' : 
                                                trend === 'down' ? 'text-brand-navy' : 'text-gray-500'
                                              }`}>
                                                {trendValue > 0 ? '+' : ''}{trendValue}%
                                              </span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                      <div className="text-right text-sm text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                          <Clock size={12} />
                                          <span>Current cycle</span>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Progress Bar */}
                                    <div className="mb-3">
                                      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                        <div 
                                          className={`h-full ${getProgressColor(score)} transition-all duration-500`}
                                          style={{ width: `${score}%` }}
                                        />
                                      </div>
                                    </div>
                                    
                                    {/* Stats Row */}
                                    <div className="flex items-center justify-between text-sm border-t pt-3">
                                      <div className="flex items-center gap-1 text-muted-foreground">
                                        <CheckCircle size={14} className="text-brand-accent" />
                                        <span>Completed: <strong className="text-foreground">
                                          {insight.completedAt ? new Date(insight.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
                                        </strong></span>
                                      </div>
                                      <p className="text-xs text-muted-foreground">{insight.description}</p>
                                    </div>
                                </div>
                              );
                            })}
                        </div>

                        {/* Traditional LBI Insights (non-LBI) */}
                        {(() => {
                          const traditionalInsights = dashboardData.insights.filter((i: any) => !i.source || (i.source !== 'LBI' && i.source !== 'Lbi'));
                          if (traditionalInsights.length === 0) return null;
                          
                          const insightsByCategory = traditionalInsights.reduce((acc: Record<string, any[]>, insight: any) => {
                            if (!acc[insight.category]) acc[insight.category] = [];
                            acc[insight.category].push(insight);
                            return acc;
                          }, {});
                          
                          return (
                            <>
                              <h3 className="text-lg font-semibold mt-6 mb-3">Additional Learning Metrics</h3>
                              <div className="grid gap-4 md:grid-cols-2">
                                {Object.entries(insightsByCategory).map(([category, insights]) => (
                                  <div key={category} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                                    <div className="flex items-center gap-2 mb-4">
                                      <span style={{ color: BRAND.navy }}><BarChart3 size={18} /></span>
                                      <h3 className="text-sm font-semibold text-gray-800">{category}</h3>
                                    </div>
                                    <div className="space-y-3">
                                      {(insights as any[]).map((insight) => {
                                        const val = typeof insight.value === 'number' ? insight.value : 0;
                                        return (
                                          <div key={insight.id}>
                                            <div className="flex justify-between items-center mb-1">
                                              <span className="text-sm">{insight.metric}</span>
                                              <Badge variant={val >= 80 ? 'default' : val >= 60 ? 'secondary' : 'outline'}>
                                                {val >= 80 ? 'Strong' : val >= 60 ? 'Moderate' : 'Developing'}
                                              </Badge>
                                            </div>
                                            <Progress value={val} />
                                            {insight.description && (
                                              <p className="text-xs text-muted-foreground mt-1">{insight.description}</p>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </>
                          );
                        })()}

                        {/* Strengths & Growth Areas */}
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="bg-white border border-[#A8D5BB] rounded-2xl p-5 shadow-sm">
                            <div className="mb-3">
                              <div className="flex items-center gap-2">
                                <Award size={18} className="text-brand-accent" />
                                <h3 className="text-sm font-semibold text-brand-accent">Key Strengths</h3>
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">Areas where {selectedChild.name} excels</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {dashboardData.insights
                                .filter((i: any) => (typeof i.value === 'number' ? i.value : 0) >= 80)
                                .map((insight: any) => (
                                  <Badge 
                                    key={insight.id} 
                                    className="bg-[#C9E8D8] text-brand-accent border-[#A8D5BB]"
                                  >
                                    {(insight.source === 'LBI' || insight.source === 'Lbi') ? insight.category : insight.metric}
                                  </Badge>
                                ))
                              }
                              {dashboardData.insights.filter((i: any) => (typeof i.value === 'number' ? i.value : 0) >= 80).length === 0 && (
                                <p className="text-sm text-muted-foreground">Complete more assessments to identify strengths.</p>
                              )}
                            </div>
                          </div>
                          
                          <div className="bg-white border border-[#B8CCDA] rounded-2xl p-5 shadow-sm">
                            <div className="mb-3">
                              <div className="flex items-center gap-2">
                                <Target size={18} className="text-brand-navy" />
                                <h3 className="text-sm font-semibold text-brand-navy">Growth Opportunities</h3>
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">Areas for focused development</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {dashboardData.insights
                                .filter((i: any) => (typeof i.value === 'number' ? i.value : 0) < 60)
                                .map((insight: any) => (
                                  <Badge 
                                    key={insight.id} 
                                    className="bg-[#FFF0C2] text-brand-navy border-[#B8CCDA]"
                                  >
                                    {(insight.source === 'LBI' || insight.source === 'Lbi') ? insight.category : insight.metric}
                                  </Badge>
                                ))
                              }
                              {dashboardData.insights.filter((i: any) => (typeof i.value === 'number' ? i.value : 0) < 60).length === 0 && (
                                <p className="text-sm text-muted-foreground">Great job! No areas need immediate attention.</p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* CTA: Continue modules */}
                        {hasConsent && (
                          <div className="flex items-center justify-between px-4 py-3 rounded-2xl mt-2" style={{ background: 'rgba(11,60,93,0.04)', border: '1px solid rgba(11,60,93,0.1)' }}>
                            <div>
                              <p className="text-xs font-semibold" style={{ color: BRAND.navy }}>Take remaining LBI modules</p>
                              <p className="text-2xs text-gray-400 mt-0.5">Completing all 8 modules unlocks the full behavioural profile</p>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => onNavigate('parent-lbi', { childId: selectedChild.id, lbiTab: 'assessments' })}
                              className="text-white font-semibold text-xs"
                              style={{ backgroundColor: BRAND.navy }}
                              data-testid="button-continue-lbi"
                            >
                              <Brain className="w-3 h-3 mr-1.5" />
                              Open Assessments
                            </Button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="bg-white border border-gray-100 rounded-2xl p-12 shadow-sm text-center">
                        <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                          <Brain size={32} className="text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">No Behavioural Insights Yet</h3>
                        <p className="text-muted-foreground max-w-md mx-auto mb-6">
                          Behavioural insights will appear here once {selectedChild.name} completes assessments. These insights help understand learning patterns and preferences.
                        </p>
                        {hasConsent && (
                          <Button 
                            onClick={() => onNavigate('parent-lbi', { childId: selectedChild.id, lbiTab: 'assessments' })}
                            className="text-gray-900 font-semibold hover:opacity-90"
                            style={{ backgroundColor: BRAND.accent }}
                            data-testid="button-start-lbi"
                          >
                            <Brain className="w-4 h-4 mr-2" />
                            Start LBI Assessment
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Subject-Linked LBI Report */}
                {selectedChild && canAccessLBI && (
                  <SubjectLBIReport
                    childName={selectedChild.name}
                    childId={selectedChild.id}
                    lbiData={dashboardData?.lbiData}
                    hasConsent={!!selectedChild.lbiConsent}
                  />
                )}
              </TabsContent>

              {/* My Packages Tab */}
              <TabsContent value="my-packages" className="mt-6 space-y-5">
                {/* Children's Assigned Packages - Compact rows */}
                <Card className="border shadow-sm" data-testid="my-packages-header">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2" style={{ color: BRAND.navy }}>
                        <Award size={18} style={{ color: BRAND.accent }} />
                        My Children's Packages
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(dashboardData?.children || []).map((child) => {
                      const subs = childSubscriptions.filter(s => s.childId === child.id);
                      return (
                        <div key={child.id} className="p-3 rounded-lg border space-y-2" data-testid={`child-packages-${child.id}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full flex items-center justify-center text-white font-semibold text-sm" style={{ backgroundColor: BRAND.navy }}>
                                {child.name?.charAt(0) || 'C'}
                              </div>
                              <div>
                                <p className="text-sm font-medium" style={{ color: BRAND.navy }}>{child.name}</p>
                                <p className="text-xs text-muted-foreground">{child.grade || 'Grade not set'}</p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              className="h-7 px-3 text-xs text-white"
                              style={{ backgroundColor: BRAND.accent }}
                              onClick={handleExamReadyStart}
                              data-testid={`btn-buy-package-${child.id}`}
                            >
                              <Plus size={12} className="mr-1" />
                              Add
                            </Button>
                          </div>
                          {subs.length > 0 ? (
                            <div className="space-y-1.5 pl-12">
                              {subs.map((sub: any) => (
                                <div key={sub.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border">
                                  <div className="flex items-center gap-2">
                                    <Award size={14} style={{ color: BRAND.accent }} />
                                    <div>
                                      <p className="text-xs font-semibold" style={{ color: BRAND.navy }}>{sub.productName}</p>
                                      <p className="text-2xs text-muted-foreground">
                                        {sub.category} • {sub.billingType}{sub.expiryDate ? ` • Expires ${new Date(sub.expiryDate).toLocaleDateString()}` : ''}
                                      </p>
                                    </div>
                                  </div>
                                  <Badge
                                    className={`text-2xs ${sub.status === 'active' ? 'bg-[#C9E8D8] text-brand-accent' : sub.status === 'expired' ? 'bg-[#EDF2F7] text-brand-navy' : 'bg-gray-100 text-gray-600'}`}
                                  >
                                    {sub.status}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground pl-12">No active packages</p>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                {/* Available Packages */}
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm" data-testid="available-packages">
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ color: BRAND.accent }}><Target size={18} /></span>
                    <h3 className="text-base font-semibold text-gray-800">Available Assessment Packages</h3>
                  </div>
                  <p className="text-xs text-gray-400 mb-4">Choose a package to get started</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {subscriptionPackages.slice(0, 6).map((pkg) => (
                        <div
                          key={pkg.id}
                          className="p-4 rounded-2xl border border-gray-100 hover:shadow-md transition-all cursor-pointer relative bg-gray-50/50"
                          style={{ borderColor: pkg.isRecommended ? BRAND.accent : '#e5e7eb' }}
                          onClick={handleExamReadyStart}
                          data-testid={`pkg-card-${pkg.id}`}
                        >
                          {pkg.isRecommended && (
                            <span className="absolute top-2 right-2 text-2xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: BRAND.accent }}>
                              Recommended
                            </span>
                          )}
                          <h4 className="text-sm font-semibold mb-1" style={{ color: BRAND.navy }}>{pkg.productName}</h4>
                          <p className="text-xs text-muted-foreground mb-2">{pkg.studentSegment}</p>
                          <div className="flex flex-wrap gap-1 mb-3">
                            {pkg.domainsCovered?.slice(0, 3).map((d, i) => (
                              <span key={i} className="text-2xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{d}</span>
                            ))}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold" style={{ color: BRAND.navy }}>₹{pkg.price}</span>
                            <span className="text-xs font-medium" style={{ color: BRAND.accent }}>View Details</span>
                          </div>
                        </div>
                      ))}
                    </div>
                </div>
              </TabsContent>

              {/* Mentor Services Tab */}
              <TabsContent value="mentor-services" className="mt-6">
                <ParentMentorServices
                  selectedChild={selectedChild ? {
                    id: selectedChild.id,
                    name: selectedChild.name,
                    grade: selectedChild.grade ?? undefined,
                    educationBoard: selectedChild.educationBoard ?? undefined,
                    lbiConsent: selectedChild.lbiConsent ?? false,
                    age: selectedChild.age ?? undefined,
                    school: selectedChild.school ?? undefined,
                  } : null}
                  onNavigate={(screen, data) => {
                    if (screen === 'exam-trends') {
                      setActiveTab('exam-trends');
                    } else if (screen === 'tests-planner') {
                      setActiveTab('education');
                      setLearningSection('tests');
                    } else if (screen === 'education') {
                      setActiveTab('education');
                      setLearningSection('academics');
                    } else if (screen === 'parent-lbi') {
                      onNavigate('parent-lbi', data);
                    } else {
                      onNavigate(screen as any, data);
                    }
                  }}
                  onSessionBooked={(session) => {
                    setBookedMentorSessions(prev => [session, ...prev]);
                  }}
                />
              </TabsContent>

              {/* Learning Collab Tab */}
              <TabsContent value="learning-collab" className="mt-6">
                <LearningCollabTab
                  selectedChild={selectedChild ? {
                    id: selectedChild.id,
                    name: selectedChild.name,
                    grade: selectedChild.grade ?? undefined,
                  } : null}
                  dashboardData={dashboardData ? {
                    children: dashboardData.children ?? [],
                    exams: dashboardData.exams ?? [],
                    goals: (dashboardData as any).goals ?? [],
                  } : null}
                  onNavigate={(screen, params) => {
                    if (params?.tab) {
                      handleMenuSelect(params.tab as string);
                    } else {
                      onNavigate(screen as any, params as any);
                    }
                  }}
                />
              </TabsContent>

              {/* Goals Tab */}
              <TabsContent value="goals" className="mt-6">
                {selectedChild ? (
                  <ParentChildGoals
                    childId={selectedChild.id}
                    childName={selectedChild.name}
                  />
                ) : (
                  <div className="text-center py-12 text-gray-400">Select a child to manage goals.</div>
                )}
              </TabsContent>

            </Tabs>
            </div>
          </>
        )}

          {/* Quick Tour Overlay */}
          {showTour && (
            <QuickTour
              type="parent"
              onClose={() => setShowTour(false)}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {/* Global Search */}
          {showSearch && (
            <GlobalSearch
              role="parent"
              onNavigate={(screen) => onNavigate(screen as any)}
              onMenuSelect={(item) => handleMenuSelect(item)}
              onClose={() => setShowSearch(false)}
              onShowTour={() => setShowTour(true)}
            />
          )}

          {/* Milestone Celebration Overlay */}
          {showMilestones && pendingMilestones.length > 0 && (
            <MilestoneCelebration
              milestones={pendingMilestones}
              childName={selectedChild?.name ?? ''}
              onDismiss={() => setShowMilestones(false)}
            />
          )}

          {showShareLBIReport && selectedChild && (() => {
            const lbiInsights = (dashboardData?.insights ?? []).filter((i: any) => i.source === 'LBI' || i.source === 'Lbi');
            const totalSc = lbiInsights.reduce((s: number, i: any) => s + (typeof i.value === 'number' ? i.value : 0), 0);
            const avgSc   = lbiInsights.length > 0 ? Math.round(totalSc / lbiInsights.length) : 0;
            return (
              <ShareLBIReport
                child={{ name: selectedChild.name, grade: selectedChild.grade ?? '' }}
                insights={lbiInsights.map((i: any) => ({ category: i.category, value: typeof i.value === 'number' ? i.value : 0, trend: i.trend, trendValue: i.trendValue, description: i.description }))}
                avgScore={avgSc}
                totalScore={totalSc}
                maxScore={lbiInsights.length * 100 || 700}
                onClose={() => setShowShareLBIReport(false)}
              />
            );
          })()}

          {/* Help Panel */}
          <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} onNavigate={setActiveTab} />

      {/* Exam Readiness Child Picker Dialog */}
      <Dialog open={isExamReadyPickerOpen} onOpenChange={setIsExamReadyPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" style={{ color: BRAND.navy }} />
              Start ExamReadiness Assessment
            </DialogTitle>
            <DialogDescription>
              Select which child to assess and who will take the exam.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Child Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-700">Select Child</Label>
              <div className="space-y-2">
                {dashboardData?.children?.map((child) => {
                  const isSelected = examReadySelectedChildId === child.id;
                  return (
                    <button
                      key={child.id}
                      onClick={() => setExamReadySelectedChildId(child.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left"
                      style={{
                        borderColor: isSelected ? BRAND.navy : BRAND.border,
                        backgroundColor: isSelected ? '#EDF2F7' : '#FAFBFC',
                      }}
                    >
                      <div
                        className="h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                        style={{ background: isSelected ? BRAND.navy : BRAND.slate }}
                      >
                        {getInitials(child.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate">{child.name}</p>
                        <p className="text-xs text-gray-500">
                          {child.age ? `Age ${child.age}` : ''}
                          {child.grade ? ` · ${child.grade}` : ''}
                          {(child as any)?.board ? ` · ${(child as any).board}` : ''}
                        </p>
                      </div>
                      {isSelected && (
                        <CheckCircle className="h-5 w-5 shrink-0" style={{ color: BRAND.navy }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Who takes the exam */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-700">Who will take the exam?</Label>
              <RadioGroup
                value={examTakenBy}
                onValueChange={(v) => setExamTakenBy(v as 'child' | 'parent')}
                className="space-y-2"
              >
                <label
                  className="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all"
                  style={{
                    borderColor: examTakenBy === 'child' ? BRAND.navy : BRAND.border,
                    backgroundColor: examTakenBy === 'child' ? '#EDF2F7' : '#FAFBFC',
                  }}
                >
                  <RadioGroupItem value="child" id="exam-taker-child" />
                  <div>
                    <p className="font-semibold text-sm text-gray-900">Child takes the exam</p>
                    <p className="text-xs text-gray-500">The child will answer the assessment themselves</p>
                  </div>
                </label>
                <label
                  className="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all"
                  style={{
                    borderColor: examTakenBy === 'parent' ? BRAND.navy : BRAND.border,
                    backgroundColor: examTakenBy === 'parent' ? '#EDF2F7' : '#FAFBFC',
                  }}
                >
                  <RadioGroupItem value="parent" id="exam-taker-parent" />
                  <div>
                    <p className="font-semibold text-sm text-gray-900">Parent on behalf of child</p>
                    <p className="text-xs text-gray-500">You will answer on your child's behalf (supervised mode)</p>
                  </div>
                </label>
              </RadioGroup>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsExamReadyPickerOpen(false)}>Cancel</Button>
            <Button
              className="text-white"
              style={{ backgroundColor: BRAND.navy }}
              disabled={!examReadySelectedChildId}
              onClick={handleExamReadyConfirm}
            >
              <Play className="h-4 w-4 mr-2" />
              Start Assessment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isConsentDialogOpen} onOpenChange={setIsConsentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {consentAction === 'grant' ? 'Grant Consent for Learning Behaviour Insights' : 'Revoke Consent'}
            </DialogTitle>
            <DialogDescription>
              {consentAction === 'grant' 
                ? 'By granting consent, you allow MetryxOne to collect and analyze your child\'s learning behaviour patterns. This data is used to provide personalized insights and is protected under DPDP Act guidelines.'
                : 'By revoking consent, Learning Behaviour Insights tracking will be disabled. Historical data will be retained as per DPDP Act requirements but no new data will be collected.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="rounded-lg border p-4 bg-muted/50">
              <p className="text-sm font-medium mb-2">What this means:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {consentAction === 'grant' ? (
                  <>
                    <li>• Behavioural patterns during learning will be analyzed</li>
                    <li>• No academic judgments - only learning style insights</li>
                    <li>• Data is encrypted and securely stored</li>
                    <li>• You can revoke consent at any time</li>
                  </>
                ) : (
                  <>
                    <li>• No new behavioural data will be collected</li>
                    <li>• Access to LBI insights will be disabled</li>
                    <li>• You can grant consent again at any time</li>
                  </>
                )}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConsentDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleConsentAction}
              variant={consentAction === 'revoke' ? 'destructive' : 'default'}
              data-testid="button-confirm-consent"
            >
              {consentAction === 'grant' ? 'Grant Consent' : 'Revoke Consent'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Child Dialog - Always rendered - Comprehensive 4-Step Form */}
      <Dialog open={isAddChildOpen} onOpenChange={(open) => { setIsAddChildOpen(open); if (!open) resetAddChildForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" style={{ fontFamily: 'Inter, sans-serif' }}>
          <DialogHeader className="pb-4 border-b" style={{ borderColor: 'rgba(11,60,93,0.08)' }}>
            <div className="flex items-center gap-4">
              <div 
                className="h-12 w-12 rounded-xl flex items-center justify-center shadow-lg"
                style={{ backgroundColor: BRAND.navy }}
              >
                <UserPlus size={24} className="text-white" />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-xl font-bold" style={{ color: BRAND.navy }}>Register Your Child</DialogTitle>
                <DialogDescription className="text-sm mt-1">
                  <span style={{ color: BRAND.accent, fontWeight: 600 }}>Step {addChildStep}</span>
                  <span className="mx-2 text-gray-300">|</span>
                  <span className="text-gray-600">{addChildStep === 1 ? 'Personal Information' : addChildStep === 2 ? 'Education Details' : addChildStep === 3 ? 'Learning Profile' : addChildStep === 4 ? 'Consents & Privacy' : 'Set First Goal'}</span>
                </DialogDescription>
              </div>
            </div>
            
            {/* Progress Steps */}
            <div className="flex items-center gap-1 mt-6">
              {[
                { step: 1, label: 'Personal', icon: User },
                { step: 2, label: 'Education', icon: GraduationCap },
                { step: 3, label: 'Learning', icon: Brain },
                { step: 4, label: 'Consent', icon: Shield },
                { step: 5, label: 'Goal', icon: Target }
              ].map(({ step, label, icon: Icon }) => (
                <div key={step} className="flex-1 flex items-center gap-1">
                  <div 
                    className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0 ${step <= addChildStep ? 'text-white shadow-md' : 'text-gray-400 bg-gray-100'}`}
                    style={{ backgroundColor: step <= addChildStep ? (step === addChildStep ? BRAND.accent : BRAND.navy) : undefined }}
                  >
                    {step < addChildStep ? <CheckCircle size={14} /> : <Icon size={13} />}
                  </div>
                  <span className={`text-2xs font-medium hidden sm:block ${step <= addChildStep ? 'text-gray-800' : 'text-gray-400'}`}>{label}</span>
                  {step < 5 && <div className="flex-1 h-0.5 rounded-full mx-1" style={{ backgroundColor: step < addChildStep ? BRAND.accent : '#e5e7eb' }} />}
                </div>
              ))}
            </div>
          </DialogHeader>

          {/* Step 1: Personal Information */}
          {addChildStep === 1 && (
            <div className="grid gap-5 py-5">
              <div 
                className="p-4 rounded-xl border-l-4"
                style={{ backgroundColor: 'rgba(11,60,93,0.04)', borderLeftColor: BRAND.navy }}
              >
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: BRAND.navy }}>
                    <Shield size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: BRAND.navy }}>Secure Data Collection</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Your child's data is encrypted and protected under DPDP Act 2023 compliance.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label className="text-sm font-semibold" style={{ color: BRAND.navy }}>Full Name <span style={{ color: BRAND.accent }}>*</span></Label>
                  <Input 
                    value={newChildName} 
                    onChange={(e) => setNewChildName(e.target.value)}
                    placeholder="Enter child's full name"
                    className="h-11 rounded-lg border-gray-200 focus:border-brand-accent focus:ring-brand-accent"
                    data-testid="input-child-name-standalone"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="text-sm font-semibold" style={{ color: BRAND.navy }}>Date of Birth <span style={{ color: BRAND.accent }}>*</span></Label>
                    <Input 
                      type="date"
                      value={newChildDOB} 
                      onChange={(e) => {
                        setNewChildDOB(e.target.value);
                        const age = Math.floor((Date.now() - new Date(e.target.value).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
                        if (age > 0 && age < 30) setNewChildAge(age.toString());
                      }}
                      className="h-11 rounded-lg"
                      data-testid="input-child-dob-standalone"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm font-semibold" style={{ color: BRAND.navy }}>Gender <span style={{ color: BRAND.accent }}>*</span></Label>
                    <Select value={newChildGender} onValueChange={setNewChildGender}>
                      <SelectTrigger className="h-11 rounded-lg" data-testid="select-child-gender-standalone">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        {GENDERS.map(g => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="text-sm font-semibold" style={{ color: BRAND.navy }}>Blood Group</Label>
                    <Select value={newChildBloodGroup} onValueChange={setNewChildBloodGroup}>
                      <SelectTrigger className="h-11 rounded-lg" data-testid="select-child-blood-standalone">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {BLOOD_GROUPS.map(b => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm font-semibold" style={{ color: BRAND.navy }}>Primary Language <span style={{ color: BRAND.accent }}>*</span></Label>
                    <Select value={newChildLanguage} onValueChange={setNewChildLanguage}>
                      <SelectTrigger className="h-11 rounded-lg" data-testid="select-child-language-standalone">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map(l => (
                          <SelectItem key={l} value={l}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="text-sm font-semibold" style={{ color: BRAND.navy }}>Your Relationship <span style={{ color: BRAND.accent }}>*</span></Label>
                    <Select value={newChildRelationship} onValueChange={setNewChildRelationship}>
                      <SelectTrigger className="h-11 rounded-lg" data-testid="select-child-relationship-standalone">
                        <SelectValue placeholder="Select relationship" />
                      </SelectTrigger>
                      <SelectContent>
                        {RELATIONSHIPS.map(r => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm font-semibold" style={{ color: BRAND.navy }}>Emergency Contact</Label>
                    <Input 
                      value={newChildEmergencyContact} 
                      onChange={(e) => setNewChildEmergencyContact(e.target.value)}
                      placeholder="Phone number"
                      className="h-11 rounded-lg"
                      data-testid="input-child-emergency-standalone"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Education Details */}
          {addChildStep === 2 && (
            <div className="grid gap-5 py-5">
              <div 
                className="p-4 rounded-xl border-l-4"
                style={{ backgroundColor: 'rgba(78,205,196,0.05)', borderLeftColor: BRAND.accent }}
              >
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: BRAND.accent }}>
                    <GraduationCap size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: BRAND.navy }}>Education Information</p>
                    <p className="text-xs text-gray-600 mt-1">
                      This helps us tailor content to your child's curriculum and academic level.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="text-sm font-semibold" style={{ color: BRAND.navy }}>Grade/Class <span style={{ color: BRAND.accent }}>*</span></Label>
                    <Select value={newChildGrade} onValueChange={setNewChildGrade}>
                      <SelectTrigger className="h-11 rounded-lg" data-testid="select-child-grade-standalone">
                        <SelectValue placeholder="Select grade" />
                      </SelectTrigger>
                      <SelectContent>
                        {GRADES.map(grade => (
                          <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm font-semibold" style={{ color: BRAND.navy }}>Education Board <span style={{ color: BRAND.accent }}>*</span></Label>
                    <Select value={newChildBoard} onValueChange={setNewChildBoard}>
                      <SelectTrigger className="h-11 rounded-lg" data-testid="select-child-board-standalone">
                        <SelectValue placeholder="Select board" />
                      </SelectTrigger>
                      <SelectContent>
                        {BOARDS.map(b => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="text-sm font-semibold" style={{ color: BRAND.navy }}>School Type</Label>
                    <Select value={newChildSchoolType} onValueChange={setNewChildSchoolType}>
                      <SelectTrigger className="h-11 rounded-lg" data-testid="select-child-school-type-standalone">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {SCHOOL_TYPES.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm font-semibold" style={{ color: BRAND.navy }}>Medium of Instruction</Label>
                    <Select value={newChildMedium} onValueChange={setNewChildMedium}>
                      <SelectTrigger className="h-11 rounded-lg" data-testid="select-child-medium-standalone">
                        <SelectValue placeholder="Select medium" />
                      </SelectTrigger>
                      <SelectContent>
                        {MEDIUM_OF_INSTRUCTION.map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label className="text-sm font-semibold" style={{ color: BRAND.navy }}>School/Institution Name</Label>
                  <Input 
                    value={newChildSchool} 
                    onChange={(e) => setNewChildSchool(e.target.value)}
                    placeholder="Enter school name"
                    className="h-11 rounded-lg"
                    data-testid="input-child-school-standalone"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="text-sm font-semibold" style={{ color: BRAND.navy }}>City</Label>
                    <Input 
                      value={newChildCity} 
                      onChange={(e) => setNewChildCity(e.target.value)}
                      placeholder="Enter city"
                      className="h-11 rounded-lg"
                      data-testid="input-child-city-standalone"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm font-semibold" style={{ color: BRAND.navy }}>State</Label>
                    <Select value={newChildState} onValueChange={setNewChildState}>
                      <SelectTrigger className="h-11 rounded-lg" data-testid="select-child-state-standalone">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATES.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Learning Profile */}
          {addChildStep === 3 && (
            <div className="grid gap-5 py-5">
              <div 
                className="p-4 rounded-xl border-l-4"
                style={{ backgroundColor: 'rgba(11,60,93,0.04)', borderLeftColor: BRAND.navy }}
              >
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: BRAND.navy }}>
                    <Brain size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: BRAND.navy }}>Learning Profile</p>
                    <p className="text-xs text-gray-600 mt-1">
                      This helps us provide personalized learning recommendations and insights.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="text-sm font-semibold" style={{ color: BRAND.navy }}>Learning Style</Label>
                    <Select value={newChildLearningStyle} onValueChange={setNewChildLearningStyle}>
                      <SelectTrigger className="h-11 rounded-lg" data-testid="select-child-learning-style-standalone">
                        <SelectValue placeholder="Select style" />
                      </SelectTrigger>
                      <SelectContent>
                        {LEARNING_STYLES.map(l => (
                          <SelectItem key={l} value={l}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm font-semibold" style={{ color: BRAND.navy }}>Daily Study Hours</Label>
                    <Select value={newChildStudyHours} onValueChange={setNewChildStudyHours}>
                      <SelectTrigger className="h-11 rounded-lg" data-testid="select-child-study-hours-standalone">
                        <SelectValue placeholder="Select hours" />
                      </SelectTrigger>
                      <SelectContent>
                        {STUDY_HOURS.map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label className="text-sm font-semibold" style={{ color: BRAND.navy }}>Favorite Subjects <span className="text-xs font-normal text-gray-500">(Select up to 3)</span></Label>
                  <div className="flex flex-wrap gap-2">
                    {SUBJECTS.map(subject => (
                      <button
                        key={subject}
                        type="button"
                        onClick={() => {
                          if (newChildFavoriteSubjects.includes(subject)) {
                            setNewChildFavoriteSubjects(prev => prev.filter(s => s !== subject));
                          } else if (newChildFavoriteSubjects.length < 3) {
                            setNewChildFavoriteSubjects(prev => [...prev, subject]);
                          }
                        }}
                        className={`px-3 py-2 text-xs font-medium rounded-lg border-2 transition-all`}
                        style={newChildFavoriteSubjects.includes(subject) 
                          ? { borderColor: BRAND.accent, backgroundColor: 'rgba(78,205,196,0.08)', color: BRAND.navy }
                          : { borderColor: '#e5e7eb', backgroundColor: 'white' }
                        }
                        data-testid={`chip-favorite-subject-${subject.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {newChildFavoriteSubjects.includes(subject) && <span className="mr-1">✓</span>}
                        {subject}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label className="text-sm font-semibold" style={{ color: BRAND.navy }}>Needs Improvement <span className="text-xs font-normal text-gray-500">(Select up to 3)</span></Label>
                  <div className="flex flex-wrap gap-2">
                    {SUBJECTS.map(subject => (
                      <button
                        key={subject}
                        type="button"
                        onClick={() => {
                          if (newChildWeakSubjects.includes(subject)) {
                            setNewChildWeakSubjects(prev => prev.filter(s => s !== subject));
                          } else if (newChildWeakSubjects.length < 3) {
                            setNewChildWeakSubjects(prev => [...prev, subject]);
                          }
                        }}
                        className={`px-3 py-2 text-xs font-medium rounded-lg border-2 transition-all`}
                        style={newChildWeakSubjects.includes(subject) 
                          ? { borderColor: BRAND.navy, backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#92400e' }
                          : { borderColor: '#e5e7eb', backgroundColor: 'white' }
                        }
                        data-testid={`chip-weak-subject-${subject.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {newChildWeakSubjects.includes(subject) && <span className="mr-1">✓</span>}
                        {subject}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label className="text-sm font-semibold" style={{ color: BRAND.navy }}>Career Interest</Label>
                  <Select value={newChildCareerInterest} onValueChange={setNewChildCareerInterest}>
                    <SelectTrigger className="h-11 rounded-lg" data-testid="select-child-career-standalone">
                      <SelectValue placeholder="Select career interest" />
                    </SelectTrigger>
                    <SelectContent>
                      {CAREER_INTERESTS.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label className="text-sm font-semibold" style={{ color: BRAND.navy }}>Extracurricular Activities</Label>
                  <Input 
                    value={newChildExtracurricular} 
                    onChange={(e) => setNewChildExtracurricular(e.target.value)}
                    placeholder="E.g., Sports, Music, Art, Coding, Dance"
                    className="h-11 rounded-lg"
                    data-testid="input-child-extracurricular-standalone"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="text-sm font-semibold" style={{ color: BRAND.navy }}>Learning Support Needs</Label>
                    <Input 
                      value={newChildSpecialNeeds} 
                      onChange={(e) => setNewChildSpecialNeeds(e.target.value)}
                      placeholder="E.g., Dyslexia, ADHD"
                      className="h-11 rounded-lg"
                      data-testid="input-child-special-needs-standalone"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm font-semibold" style={{ color: BRAND.navy }}>Medical Conditions</Label>
                    <Input 
                      value={newChildMedicalConditions} 
                      onChange={(e) => setNewChildMedicalConditions(e.target.value)}
                      placeholder="Any medical conditions"
                      className="h-11 rounded-lg"
                      data-testid="input-child-medical-standalone"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Consents & Privacy */}
          {addChildStep === 4 && (
            <div className="grid gap-5 py-5">
              <div 
                className="p-5 rounded-xl text-white shadow-lg"
                style={{ backgroundColor: BRAND.navy }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-white/20">
                    <Shield size={20} />
                  </div>
                  <span className="font-bold text-lg">Data Protection & Privacy</span>
                </div>
                <p className="text-sm text-white/90 leading-relaxed">
                  MetryxOne is fully compliant with India's Digital Personal Data Protection Act, 2023. 
                  Your child's data is encrypted, stored securely in India, and used solely for educational development.
                </p>
              </div>

              <div 
                className="flex items-center justify-between p-4 rounded-xl"
                style={{ backgroundColor: 'rgba(11,60,93,0.04)' }}
              >
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full flex items-center justify-center" style={{ backgroundColor: BRAND.navy }}>
                    <FileText size={12} className="text-white" />
                  </div>
                  <span className="text-sm font-semibold" style={{ color: BRAND.navy }}>Required Consents</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium" style={{ color: BRAND.accent }}>
                    {[consentDataCollection, consentDPDP, acknowledgeDevelopment].filter(Boolean).length}/3 completed
                  </span>
                  <div className="w-28 h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(11,60,93,0.08)' }}>
                    <div 
                      className="h-full rounded-full transition-all"
                      style={{ 
                        width: `${([consentDataCollection, consentDPDP, acknowledgeDevelopment].filter(Boolean).length / 3) * 100}%`,
                        backgroundColor: BRAND.navy
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label 
                  className="flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all"
                  style={consentDataCollection 
                    ? { borderColor: BRAND.accent, backgroundColor: 'rgba(78,205,196,0.05)' }
                    : { borderColor: '#e5e7eb' }
                  }
                >
                  <input
                    type="checkbox"
                    checked={consentDataCollection}
                    onChange={(e) => setConsentDataCollection(e.target.checked)}
                    className="mt-0.5 w-5 h-5 rounded"
                    style={{ accentColor: BRAND.accent }}
                    data-testid="checkbox-consent-data-standalone"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold" style={{ color: BRAND.navy }}>Data Collection Consent <span style={{ color: BRAND.accent }}>*</span></span>
                      {consentDataCollection && <CheckCircle size={18} style={{ color: BRAND.accent }} />}
                    </div>
                    <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                      I consent to the collection and processing of my child's educational data for personalized insights.
                    </p>
                  </div>
                </label>

                <label 
                  className="flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all"
                  style={consentDPDP 
                    ? { borderColor: BRAND.accent, backgroundColor: 'rgba(78,205,196,0.05)' }
                    : { borderColor: '#e5e7eb' }
                  }
                >
                  <input
                    type="checkbox"
                    checked={consentDPDP}
                    onChange={(e) => setConsentDPDP(e.target.checked)}
                    className="mt-0.5 w-5 h-5 rounded"
                    style={{ accentColor: BRAND.accent }}
                    data-testid="checkbox-consent-dpdp-standalone"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold" style={{ color: BRAND.navy }}>DPDP Act 2023 Compliance <span style={{ color: BRAND.accent }}>*</span></span>
                      {consentDPDP && <CheckCircle size={18} style={{ color: BRAND.accent }} />}
                    </div>
                    <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                      I am the legal guardian and consent to data processing per DPDP Act, 2023.
                    </p>
                  </div>
                </label>

                <label 
                  className="flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all"
                  style={acknowledgeDevelopment 
                    ? { borderColor: BRAND.accent, backgroundColor: 'rgba(78,205,196,0.05)' }
                    : { borderColor: '#e5e7eb' }
                  }
                >
                  <input
                    type="checkbox"
                    checked={acknowledgeDevelopment}
                    onChange={(e) => setAcknowledgeDevelopment(e.target.checked)}
                    className="mt-0.5 w-5 h-5 rounded"
                    style={{ accentColor: BRAND.accent }}
                    data-testid="checkbox-acknowledge-dev-standalone"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold" style={{ color: BRAND.navy }}>Purpose & Data Retention <span style={{ color: BRAND.accent }}>*</span></span>
                      {acknowledgeDevelopment && <CheckCircle size={18} style={{ color: BRAND.accent }} />}
                    </div>
                    <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                      I understand data will be used for educational development and retained until deletion request.
                    </p>
                  </div>
                </label>

                <div className="pt-2">
                  <p className="text-xs font-semibold mb-2" style={{ color: BRAND.navy }}>Optional Enhancement</p>
                  <label 
                    className="flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all"
                    style={consentBehavioral 
                      ? { borderColor: BRAND.navy, backgroundColor: 'rgba(11,60,93,0.04)' }
                      : { borderColor: '#e5e7eb' }
                    }
                  >
                    <input
                      type="checkbox"
                      checked={consentBehavioral}
                      onChange={(e) => setConsentBehavioral(e.target.checked)}
                      className="mt-0.5 w-5 h-5 rounded"
                      style={{ accentColor: BRAND.navy }}
                      data-testid="checkbox-consent-behavioral-standalone"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold" style={{ color: BRAND.navy }}>Behavioral Assessment</span>
                        <Badge className="text-xs text-white px-2 py-0.5" style={{ backgroundColor: BRAND.accent }}>Recommended</Badge>
                      </div>
                      <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                        Enable Learning Behavior Index (LBI) assessments for comprehensive understanding.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: First Goal Contract */}
          {addChildStep === 5 && (
            <div className="grid gap-5 py-5">
              {/* Success banner */}
              <div className="flex items-center gap-3 p-4 rounded-xl" style={{ backgroundColor: 'rgba(78,205,196,0.08)', border: '1.5px solid rgba(78,205,196,0.25)' }}>
                <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: BRAND.accent }}>
                  <CheckCircle size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: BRAND.accent }}>{newChildName} has been registered!</p>
                  <p className="text-xs text-gray-500 mt-0.5">Now set your first goal contract — or skip and do it later from the Goals tab.</p>
                </div>
              </div>

              {/* Goal form */}
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label className="text-sm font-semibold" style={{ color: BRAND.navy }}>
                    Goal Title <span className="text-xs font-normal text-gray-400 ml-1">(optional)</span>
                  </Label>
                  <input
                    type="text"
                    value={firstGoalTitle}
                    onChange={e => setFirstGoalTitle(e.target.value)}
                    placeholder="e.g. Improve Mathematics score by 15%"
                    className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                    data-testid="input-first-goal-title"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="text-sm font-semibold" style={{ color: BRAND.navy }}>Category</Label>
                    <select
                      value={firstGoalCategory}
                      onChange={e => setFirstGoalCategory(e.target.value as 'academic' | 'behaviour' | 'wellness' | 'career')}
                      className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:border-brand-accent"
                      data-testid="select-first-goal-category"
                    >
                      <option value="academic">Academic</option>
                      <option value="behaviour">Behaviour</option>
                      <option value="wellness">Wellness</option>
                      <option value="career">Career</option>
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm font-semibold" style={{ color: BRAND.navy }}>Target Date</Label>
                    <input
                      type="date"
                      value={firstGoalTargetDate}
                      onChange={e => setFirstGoalTargetDate(e.target.value)}
                      min={new Date().toISOString().slice(0, 10)}
                      className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:border-brand-accent"
                      data-testid="input-first-goal-date"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label className="text-sm font-semibold" style={{ color: BRAND.navy }}>Description <span className="text-xs font-normal text-gray-400 ml-1">(optional)</span></Label>
                  <textarea
                    value={firstGoalDescription}
                    onChange={e => setFirstGoalDescription(e.target.value)}
                    placeholder="Describe what success looks like..."
                    rows={2}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                    data-testid="input-first-goal-desc"
                  />
                </div>

                {/* Suggested quick-picks */}
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: BRAND.navy }}>Quick suggestions</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { title: 'Improve Mathematics Score', category: 'academic' as const },
                      { title: 'Build a daily study habit', category: 'behaviour' as const },
                      { title: 'Explore a career path', category: 'career' as const },
                    ].map(s => (
                      <button
                        key={s.title}
                        type="button"
                        onClick={() => { setFirstGoalTitle(s.title); setFirstGoalCategory(s.category); }}
                        className="text-xs px-3 py-1.5 rounded-full border transition-all hover:shadow-sm"
                        style={{
                          borderColor: firstGoalTitle === s.title ? BRAND.accent : 'rgba(11,60,93,0.15)',
                          backgroundColor: firstGoalTitle === s.title ? 'rgba(78,205,196,0.08)' : 'transparent',
                          color: firstGoalTitle === s.title ? BRAND.accent : BRAND.navy,
                        }}
                      >
                        {s.title}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-3 pt-4 border-t" style={{ borderColor: 'rgba(11,60,93,0.08)' }}>
            {addChildStep > 1 && addChildStep < 5 && (
              <Button 
                variant="outline" 
                onClick={() => setAddChildStep(addChildStep - 1)}
                className="rounded-lg h-11 px-5"
                style={{ borderColor: BRAND.navy, color: BRAND.navy }}
                data-testid="button-prev-step-standalone"
              >
                <ChevronLeft size={16} className="mr-1" />
                Back
              </Button>
            )}
            {addChildStep < 5 && (
              <Button 
                variant="outline" 
                onClick={() => { setIsAddChildOpen(false); resetAddChildForm(); }}
                className="rounded-lg h-11 px-5"
              >
                Cancel
              </Button>
            )}
            {addChildStep < 4 ? (
              <Button 
                onClick={() => setAddChildStep(addChildStep + 1)}
                disabled={
                  (addChildStep === 1 && (!newChildName || !newChildDOB || !newChildGender || !newChildLanguage || !newChildRelationship)) ||
                  (addChildStep === 2 && (!newChildGrade || !newChildBoard))
                }
                className="rounded-lg h-11 px-6 font-semibold text-white shadow-md hover:shadow-lg transition-all"
                style={{ backgroundColor: BRAND.navy }}
                data-testid="button-next-step-standalone"
              >
                Continue
                <ChevronRight size={16} className="ml-1" />
              </Button>
            ) : addChildStep === 4 ? (
              <Button 
                onClick={handleAddChild}
                disabled={!consentDataCollection || !consentDPDP || !acknowledgeDevelopment || isAddingChild}
                className="rounded-lg h-11 px-6 font-semibold text-white shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                style={{ backgroundColor: (!consentDataCollection || !consentDPDP || !acknowledgeDevelopment || isAddingChild) ? '#9ca3af' : BRAND.navy }}
                data-testid="button-submit-add-child-standalone"
              >
                {isAddingChild ? (
                  <><RefreshCw size={16} className="mr-2 animate-spin" />Registering...</>
                ) : (
                  <><UserPlus size={16} className="mr-2" />Register Child</>
                )}
              </Button>
            ) : (
              /* Step 5 footer */
              <>
                <Button
                  variant="outline"
                  onClick={() => handleSaveFirstGoal(true)}
                  className="rounded-lg h-11 px-5"
                  style={{ borderColor: BRAND.navy, color: BRAND.navy }}
                  data-testid="button-skip-goal"
                >
                  Skip for now
                </Button>
                <Button
                  onClick={() => handleSaveFirstGoal(false)}
                  disabled={!firstGoalTitle.trim()}
                  className="rounded-lg h-11 px-6 font-semibold text-white shadow-md hover:shadow-lg transition-all disabled:opacity-40"
                  style={{ backgroundColor: firstGoalTitle.trim() ? BRAND.accent : '#9ca3af' }}
                  data-testid="button-save-first-goal"
                >
                  <Target size={16} className="mr-2" />
                  Set Goal & Finish
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Supervised Test Dialog */}
      <Dialog open={isSupervisedTestOpen} onOpenChange={setIsSupervisedTestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supervised Test Session</DialogTitle>
            <DialogDescription>
              Start a supervised test session for {selectedChild?.name}. You will be able to monitor their progress during the exam.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="rounded-lg border p-4 bg-[#EDF2F7]">
              <div className="flex items-center gap-2 text-brand-navy mb-2">
                <Eye size={18} />
                <p className="font-medium">Supervised Mode Features:</p>
              </div>
              <ul className="text-sm text-brand-navy space-y-1">
                <li>• Real-time progress monitoring</li>
                <li>• Question-by-question visibility</li>
                <li>• Time tracking and alerts</li>
                <li>• Secure environment verification</li>
              </ul>
            </div>
            <div className="mt-4 rounded-lg border p-4 bg-[#EDF2F7]">
              <p className="text-sm text-brand-navy">
                <strong>Note:</strong> Supervised test mode is available for minors (under 18) to ensure a secure testing environment with parental oversight.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSupervisedTestOpen(false)}>Cancel</Button>
            <Button 
              className="gap-2"
              onClick={async () => {
                if (!supervisedExamId || !selectedChild) return;
                
                try {
                  await startSupervisedTest(supervisedExamId, selectedChild.id);
                  setIsSupervisedTestOpen(false);
                  setSupervisedExamId(null);
                  toast({
                    title: "Supervised Test Started",
                    description: "Loading exam questions for monitoring.",
                  });
                  // Open monitoring view with questions
                  fetchExamQuestionsForMonitoring(supervisedExamId);
                } catch (error: any) {
                  // Check if session already exists (409 conflict)
                  if (error.message?.includes('already active')) {
                    setIsSupervisedTestOpen(false);
                    const currentExamId = supervisedExamId;
                    setSupervisedExamId(null);
                    toast({
                      title: "Resuming Session",
                      description: "Loading exam questions for monitoring.",
                    });
                    // Open monitoring view with questions
                    fetchExamQuestionsForMonitoring(currentExamId);
                  } else {
                    toast({
                      title: "Error",
                      description: error.message || "Failed to start supervised test",
                      variant: "destructive",
                    });
                  }
                }
              }}
              data-testid="button-confirm-supervised-test"
            >
              <Play size={16} />
              Start Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Supervised Exam Player Dialog */}
      <Dialog open={isMonitoringOpen} onOpenChange={(open) => {
        if (!open) closeMonitoringDialog();
      }}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2" style={{ color: BRAND.navy }}>
              <BookOpen size={20} />
              {examSubmitted ? 'Exam Results' : 'Supervised Exam'} - {monitoringExam?.title}
            </DialogTitle>
            <DialogDescription>
              {examSubmitted 
                ? `Results for ${selectedChild?.name}'s exam`
                : `${selectedChild?.name}, please answer each question. Parent is monitoring.`
              }
            </DialogDescription>
          </DialogHeader>
          
          {loadingMonitoring ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="animate-spin" size={24} style={{ color: BRAND.navy }} />
            </div>
          ) : examSubmitted && examResult ? (
            <div className="flex-1 overflow-y-auto py-4">
              {/* Results View */}
              <div className="text-center py-8">
                <div className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center" 
                  style={{ backgroundColor: examResult.percentage >= 60 ? BRAND.accent : BRAND.navy }}>
                  <span className="text-3xl font-bold text-white">{examResult.percentage}%</span>
                </div>
                <h3 className="text-2xl font-bold mb-2" style={{ color: BRAND.navy }}>
                  {examResult.percentage >= 80 ? 'Excellent!' : examResult.percentage >= 60 ? 'Good Job!' : 'Keep Practicing!'}
                </h3>
                <p className="text-lg text-gray-600 mb-6">
                  Score: {examResult.score} / {examResult.total}
                </p>
                
                {/* Detailed Results */}
                <div className="text-left space-y-3 mt-6">
                  <h4 className="font-semibold text-gray-700 mb-3">Answer Review:</h4>
                  {monitoringQuestions.map((q, idx) => {
                    const userAnswer = studentAnswers[q.id];
                    const isCorrect = userAnswer === q.correctOption;
                    return (
                      <div key={q.id} className={`p-3 rounded-lg border ${isCorrect ? 'bg-[#EDF7F2] border-[#A8D5BB]' : 'bg-[#FEF2F2] border-[#E8ECF2]'}`}>
                        <div className="flex items-start gap-2">
                          <span className="font-bold text-gray-600">{idx + 1}.</span>
                          <div className="flex-1">
                            <p className="text-sm text-gray-800">{q.questionText}</p>
                            <p className="text-xs mt-1">
                              Your answer: <span className={isCorrect ? 'text-brand-accent font-medium' : 'text-brand-navy font-medium'}>{userAnswer || 'Not answered'}</span>
                              {!isCorrect && <span className="text-brand-accent ml-2">Correct: {q.correctOption}</span>}
                            </p>
                          </div>
                          {isCorrect ? <CheckCircle size={18} className="text-brand-accent" /> : <AlertTriangle size={18} className="text-brand-navy" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-4 py-4">
              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Progress: {Object.keys(studentAnswers).length} / {monitoringQuestions.length}</span>
                  <span className="text-gray-600">{monitoringExam?.subject} - {monitoringExam?.grade}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full transition-all" 
                    style={{ 
                      width: `${(Object.keys(studentAnswers).length / monitoringQuestions.length) * 100}%`,
                      backgroundColor: BRAND.navy
                    }}
                  />
                </div>
              </div>

              {/* Questions List - Interactive */}
              <div className="space-y-4">
                {monitoringQuestions.map((q, idx) => (
                  <div key={q.id} className="p-4 rounded-lg border bg-white">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: BRAND.navy }}>
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 mb-3">{q.questionText}</p>
                        <div className="grid grid-cols-1 gap-2">
                          {['A', 'B', 'C', 'D'].map(opt => {
                            const optionText = q[`option${opt}`];
                            if (!optionText) return null;
                            const isSelected = studentAnswers[q.id] === opt;
                            return (
                              <button 
                                key={opt}
                                onClick={() => setStudentAnswers(prev => ({ ...prev, [q.id]: opt }))}
                                className={`p-3 rounded-lg border text-sm text-left transition-all ${
                                  isSelected 
                                    ? 'bg-[#C5D7E6] border-brand-navy text-brand-navy ring-2 ring-brand-navy' 
                                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                                }`}
                                data-testid={`option-${q.id}-${opt}`}
                              >
                                <span className="font-medium">{opt}.</span> {optionText}
                                {isSelected && <CheckCircle size={16} className="inline ml-2 text-brand-navy" />}
                              </button>
                            );
                          })}
                        </div>
                        <div className="mt-2">
                          <span className="text-xs text-gray-500">Marks: {q.marks || 1}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="border-t pt-4">
            {examSubmitted ? (
              <Button onClick={closeMonitoringDialog} style={{ backgroundColor: BRAND.navy }}>
                Close & Return to Dashboard
              </Button>
            ) : (
              <div className="flex items-center justify-between w-full">
                <span className="text-sm text-gray-500">
                  {Object.keys(studentAnswers).length} of {monitoringQuestions.length} answered
                </span>
                <Button 
                  onClick={submitSupervisedExam}
                  disabled={submittingExam || Object.keys(studentAnswers).length === 0}
                  style={{ backgroundColor: BRAND.accent }}
                  data-testid="button-submit-exam"
                >
                  {submittingExam ? (
                    <>
                      <RefreshCw className="animate-spin mr-2" size={16} />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send size={16} className="mr-2" />
                      Submit Exam
                    </>
                  )}
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t px-2 py-2 z-20">
        <div className="flex justify-around">
          <button
            onClick={() => { setActiveMenuItem('dashboard'); setActiveTab('overview'); }}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg ${
              activeTab === 'overview' ? 'text-brand-navy' : 'text-muted-foreground'
            }`}
            data-testid="nav-overview"
          >
            <Home className="h-5 w-5" />
            <span className="text-xs">Home</span>
          </button>
          <button
            onClick={() => { setActiveMenuItem('education'); setActiveTab('education'); }}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg ${
              activeTab === 'education' ? 'text-brand-navy' : 'text-muted-foreground'
            }`}
            data-testid="nav-education"
          >
            <Layers className="h-5 w-5" />
            <span className="text-xs">Learning</span>
          </button>
          <button
            onClick={() => { setActiveMenuItem('lbi'); onNavigate('parent-lbi', { childId: dashboardData?.selectedChild?.id }); }}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-muted-foreground`}
            data-testid="nav-lbi"
          >
            <Brain className="h-5 w-5" />
            <span className="text-xs">LBI</span>
          </button>
          <button
            onClick={() => { setActiveMenuItem('exam-trends'); setActiveTab('exam-trends'); }}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg ${
              activeTab === 'exam-trends' ? 'text-brand-navy' : 'text-muted-foreground'
            }`}
            data-testid="nav-trends"
          >
            <PieChart className="h-5 w-5" />
            <span className="text-xs">Analytics</span>
          </button>
        </div>
      </nav>
        </main>
      </div>{/* end flex row */}

      {/* Assessment Browser Dialog */}
      <Dialog open={isAssessmentBrowserOpen} onOpenChange={(open) => { setIsAssessmentBrowserOpen(open); if (!open) setSelectedAssessmentGrade(''); }}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold" style={{ color: BRAND.navy }}>
              Assessments for {selectedChild?.name}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2 flex-wrap mt-1">
              {selectedChild?.grade ? (
                <>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: 'rgba(11,60,93,0.08)', color: BRAND.navy }}>
                    <GraduationCap size={11} /> {selectedChild.grade}
                  </span>
                  {selectedChild?.educationBoard && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: 'rgba(78,205,196,0.10)', color: BRAND.accent }}>
                      <BookOpen size={11} /> {selectedChild.educationBoard}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">Showing assessments matched to {selectedChild.name}'s grade</span>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          {/* Assessments List */}
          <ScrollArea className="flex-1 pr-4">
            {loadingAssessments ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="animate-spin" size={24} style={{ color: BRAND.navy }} />
              </div>
            ) : availableAssessments.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-gray-500">No assessments available for this grade</p>
                <p className="text-xs text-gray-400 mt-1">Try selecting a different grade</p>
              </div>
            ) : (
              <div className="space-y-3 py-2">
                {availableAssessments.map((assessment) => (
                  <div 
                    key={assessment.id}
                    className="p-4 rounded-xl border hover:shadow-md transition-all"
                    data-testid={`card-assessment-${assessment.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="font-semibold text-base" style={{ color: BRAND.navy }}>
                            {assessment.title}
                          </h4>
                          <Badge 
                            variant="outline" 
                            className="text-2xs"
                            style={{ 
                              borderColor: assessment.difficulty === 'Easy' ? BRAND.accent : assessment.difficulty === 'Hard' ? BRAND.navy : BRAND.navy,
                              color: assessment.difficulty === 'Easy' ? BRAND.accent : assessment.difficulty === 'Hard' ? BRAND.navy : BRAND.navy
                            }}
                          >
                            {assessment.difficulty}
                          </Badge>
                          {assessment.isRecommended && (
                            <Badge className="text-2xs bg-[#EDF2F7] text-brand-navy border border-[#B8CCDA]">
                              Recommended
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{assessment.description}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="text-xs bg-[#EDF2F7] text-brand-navy">
                            {assessment.subject}
                          </Badge>
                          <Badge variant="secondary" className="text-xs bg-gray-100">
                            {assessment.grade}
                          </Badge>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock size={12} /> {assessment.duration} min
                          </span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-500">
                            {assessment.totalMarks} marks
                          </span>
                        </div>
                      </div>
                      {assessment.assigned ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0" style={{ backgroundColor: 'rgba(78,205,196,0.12)', color: BRAND.accent }}>
                          <CheckCircle size={13} /> Assigned
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          className="text-xs text-white shrink-0"
                          style={{ backgroundColor: BRAND.accent }}
                          disabled={assigningAssessment === assessment.id}
                          onClick={() => assignAssessmentToChild(assessment.id)}
                          data-testid={`btn-assign-${assessment.id}`}
                        >
                          {assigningAssessment === assessment.id ? (
                            <RefreshCw size={14} className="animate-spin" />
                          ) : (
                            <>
                              <Plus size={14} className="mr-1" />
                              Assign
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setIsAssessmentBrowserOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Set Education Board Modal ─────────────────────────────── */}
      {showSetBoardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" style={{ backgroundColor: '#fff' }}>
            <div className="px-6 pt-6 pb-4" style={{ borderBottom: '1px solid #E2E8F0' }}>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(11,60,93,0.04)' }}>
                  <BookOpen size={18} style={{ color: BRAND.navy }} />
                </div>
                <div>
                  <h2 className="text-base font-bold" style={{ color: BRAND.text }}>Set Education Board</h2>
                  <p className="text-xs" style={{ color: '#9AA4B2' }}>{selectedChild?.name}</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-xs" style={{ color: BRAND.muted, lineHeight: 1.6 }}>
                Choosing the correct board unlocks curriculum-aligned exam content, subject mapping, and board-specific study plans.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {BOARDS.map(b => (
                  <button
                    key={b}
                    onClick={() => setPendingBoard(b)}
                    className="px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all"
                    style={
                      pendingBoard === b
                        ? { backgroundColor: BRAND.navy, color: '#fff', border: `2px solid ${BRAND.navy}` }
                        : { backgroundColor: BRAND.bg, color: BRAND.text, border: '2px solid #E2E8F0' }
                    }
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button
                onClick={() => setShowSetBoardModal(false)}
                className="flex-1 h-10 rounded-xl text-sm font-semibold border transition-colors"
                style={{ borderColor: BRAND.border, color: BRAND.muted }}
              >
                Cancel
              </button>
              <button
                onClick={handleSetBoard}
                disabled={!pendingBoard || savingBoard}
                className="flex-1 h-10 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                style={{ backgroundColor: BRAND.navy }}
              >
                {savingBoard ? 'Saving…' : 'Save Board'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Credential Card Dialog */}
      <Dialog open={!!newChildCredentials} onOpenChange={(open) => { if (!open) setNewChildCredentials(null); }}>
        <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl">
          {newChildCredentials && (
            <CredentialCard
              childName={newChildCredentials.childName}
              username={newChildCredentials.username}
              password={newChildCredentials.password}
              onClose={() => setNewChildCredentials(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Parent Periodic Survey Dialog */}
      <Dialog open={showPackagesPopup} onOpenChange={setShowPackagesPopup}>
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl">
          <ParentPeriodicSurvey
            childId={selectedChild?.id ?? ''}
            childName={selectedChild?.name ?? 'Child'}
            onClose={() => setShowPackagesPopup(false)}
            onSubmitted={() => setShowPackagesPopup(false)}
          />
        </DialogContent>
      </Dialog>

    </div>
  );
}
