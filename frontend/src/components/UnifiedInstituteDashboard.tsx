import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart as RechartsPie, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Screen } from '../App';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { InstituteHeader } from './institute/InstituteHeader';
import { fetchUser } from "@/lib/api";
import type { User as UserType } from "@shared/schema";
import { InstituteFooter } from './institute/InstituteFooter';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TeacherCounsellorSurvey } from './TeacherCounsellorSurvey';
import { ObservationFollowUpQueue } from './journey-tail/ObservationFollowUpQueue';
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  QuickStartGuide, 
  FeatureHighlights, 
  ContextualHelp, 
  HelpCenter, 
  FloatingHelpButton,
  HelpTooltip,
  SupportContact,
  StatusIndicator
} from "@/components/ui/HelpSystem";
import { 
  Building2, 
  Users, 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  GraduationCap,
  Calendar,
  BarChart3,
  RefreshCw,
  Eye,
  Play,
  Pause,
  TrendingUp,
  TrendingDown,
  Target,
  Award,
  BookOpen,
  ClipboardList,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  PieChart,
  Activity,
  UserPlus,
  Search,
  Filter,
  Download,
  MoreVertical,
  ChevronRight,
  Upload,
  Plus,
  X,
  FileSpreadsheet,
  HelpCircle,
  Lightbulb,
  Sparkles,
  Shield,
  Zap,
  Video,
  MessageCircle,
  Send,
  Brain,
  Wand2,
  Copy,
  FileDown,
  ThumbsUp,
  ThumbsDown,
  Home,
  LogOut
} from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AIPoweredReports } from "./AIPoweredReports";
import { LBIProductPage } from "./LBIProductPage";
import { ExamReadinessPage } from "./ExamReadinessPage";
import { MetryxAIAssistantPage } from "./MetryxAIAssistantPage";
import { SubscriptionPricingPage } from "./SubscriptionPricingPage";
import { SchoolHealthDashboard } from "./SchoolHealthDashboard";
import { QuickTour } from './QuickTour';
import { GlobalSearch } from './GlobalSearch';
import { shouldShowTour } from '@/lib/tourUtils';

const brand = {
  primary: '#0B3C5D',
  accent: '#4ECDC4',
};

interface Institute {
  id: string;
  instituteCode: string;
  legalName: string;
  displayName: string;
  status: string;
}

interface EnrollmentRequest {
  id: string;
  studentId: string;
  batchId: string;
  status: string;
  requestedOn: string;
  studentName: string;
  batchName: string;
}

interface Exam {
  id: string;
  examCode: string;
  examName: string;
  batchId: string;
  status: string;
  startAt: string;
  endAt: string;
}

interface Batch {
  id: string;
  batchCode: string;
  batchName: string;
  academicYear: string;
  status: string;
}

interface DashboardData {
  institute: Institute | null;
  stats: {
    totalStudents: number;
    totalExams: number;
    pendingEnrollments: number;
    activeExams: number;
  };
  enrollments: EnrollmentRequest[];
  exams: Exam[];
  batches: Batch[];
}

interface InstituteAnalytics {
  overallStats: {
    totalStudents: number;
    totalExams: number;
    avgScore: number;
    completionRate: number;
    activeStudents: number;
  };
  subjectPerformance: {
    subject: string;
    avgScore: number;
    examCount: number;
    bestScore: number;
    worstScore: number;
  }[];
  topPerformers: {
    studentId: string;
    studentName: string;
    avgScore: number;
    examCount: number;
    grade?: string;
  }[];
  atRiskStudents: {
    studentId: string;
    studentName: string;
    avgScore: number;
    lastExamDate?: string;
    concernType: 'low_score' | 'low_activity' | 'declining';
  }[];
  performanceTrends: { date: string; avgScore: number; examCount: number }[];
  gradeDistribution: { grade: string; studentCount: number; avgScore: number }[];
}

interface Props {
  onNavigate: (screen: Screen) => void;
  onLogout?: () => void;
}

export function UnifiedInstituteDashboard({ onNavigate, onLogout }: Props) {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [userData, setUserData] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('overview');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [analytics, setAnalytics] = useState<InstituteAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsLastRefresh, setAnalyticsLastRefresh] = useState<Date>(new Date());
  const [showCreateBatchModal, setShowCreateBatchModal] = useState(false);
  const [showCreateExamModal, setShowCreateExamModal] = useState(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showQuestionBuilderModal, setShowQuestionBuilderModal] = useState(false);
  const [selectedExamForQuestions, setSelectedExamForQuestions] = useState<Exam | null>(null);
  const [examQuestions, setExamQuestions] = useState<Array<{id: string; questionText: string; optionA: string; optionB: string; optionC?: string; optionD?: string; correctOption: string; marks: number}>>([]);
  const [newQuestion, setNewQuestion] = useState({ questionText: '', optionA: '', optionB: '', optionC: '', optionD: '', correctOption: 'A', marks: 1 });
  const [batchForm, setBatchForm] = useState({ batchCode: '', batchName: '', academicYear: '2025-26', status: 'Active' });
  const [examForm, setExamForm] = useState({ 
    examCode: '', examName: '', batchId: '', startAt: '', endAt: '', status: 'Draft',
    subject: '', classGrade: '', examType: 'Unit Test', duration: '60',
    totalMarks: '100', passingMarks: '35', negativeMarking: false, negativeMarkValue: '0.25',
    questionFormats: ['MCQ'] as string[], difficulty: 'Medium',
    shuffleQuestions: false, shuffleOptions: false,
    allowLateSubmission: false, gracePeriod: '15',
    instructions: 'Read all questions carefully before answering.\nAll questions are compulsory unless stated otherwise.\nUse of electronic devices is not permitted.',
    calculatorAllowed: false, referenceMaterial: false,
    createdBy: 'Teacher', approvalNote: ''
  });
  const [studentForm, setStudentForm] = useState({ studentCode: '', fullName: '', dob: '', status: 'Active' });
  const [profileForm, setProfileForm] = useState({ displayName: '', legalName: '' });
  const [csvData, setCsvData] = useState<Array<{batchCode: string; batchName: string; academicYear: string; status?: string}>>([]);
  const [studentCsvData, setStudentCsvData] = useState<Array<{studentCode: string; fullName: string; dob?: string; status?: string}>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importMode, setImportMode] = useState<'single' | 'csv'>('single');
  const [studentImportMode, setStudentImportMode] = useState<'single' | 'csv'>('single');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const studentFileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showHelpCenter, setShowHelpCenter] = useState(false);
  const [showQuickStart, setShowQuickStart] = useState(true);
  const [packageSubTab, setPackageSubTab] = useState<'browse' | 'bulk' | 'assigned'>('browse');
  const [showImportExamModal, setShowImportExamModal] = useState(false);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [surveyStudent, setSurveyStudent] = useState<{ id: string; name: string } | null>(null);
  const [examImportMode] = useState<'csv'>('csv');
  const [examCsvData, setExamCsvData] = useState<Array<{examCode: string; examName: string; subject?: string; class?: string; duration?: string; totalMarks?: string}>>([]);
  const examFileInputRef = useRef<HTMLInputElement>(null);
  const [aiGenTopic, setAiGenTopic] = useState('');
  const [aiGenCount, setAiGenCount] = useState('5');
  const [aiGenDifficulty, setAiGenDifficulty] = useState('Medium');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGeneratedQuestions, setAiGeneratedQuestions] = useState<Array<{question: string; optionA: string; optionB: string; optionC: string; optionD: string; answer: string}>>([]);
  const [instituteRole, setInstituteRole] = useState<'admin' | 'teacher'>('admin');
  const [pendingApprovals, setPendingApprovals] = useState<Array<{id: string; examName: string; subject: string; createdBy: string; submittedAt: string; status: string; classGrade: string; totalMarks: number}>>([
    { id: 'pa-1', examName: 'Science Unit Test Ch.5', subject: 'Science', createdBy: 'Mrs. Sharma', submittedAt: '2026-02-05', status: 'Pending', classGrade: 'Class 8', totalMarks: 50 },
    { id: 'pa-2', examName: 'Hindi Grammar Quiz', subject: 'Hindi', createdBy: 'Mr. Verma', submittedAt: '2026-02-06', status: 'Pending', classGrade: 'Class 7', totalMarks: 25 },
    { id: 'pa-3', examName: 'Math Practice Set', subject: 'Mathematics', createdBy: 'Ms. Gupta', submittedAt: '2026-02-04', status: 'Approved', classGrade: 'Class 10', totalMarks: 80 },
  ]);
  const { toast } = useToast();

  const quickStartItems = [
    {
      id: 'profile',
      title: 'Complete Your Profile',
      description: 'Add institute details and branding',
      icon: Building2,
      completed: Boolean(dashboardData?.institute?.displayName),
      action: () => setShowProfileModal(true)
    },
    {
      id: 'batch',
      title: 'Create Your First Batch',
      description: 'Organize students into batches',
      icon: Layers,
      completed: (dashboardData?.batches?.length || 0) > 0,
      action: () => setShowCreateBatchModal(true)
    },
    {
      id: 'students',
      title: 'Add Students',
      description: 'Import or add students individually',
      icon: Users,
      completed: (dashboardData?.stats?.totalStudents || 0) > 0,
      action: () => setShowAddStudentModal(true)
    },
    {
      id: 'exam',
      title: 'Create an Exam',
      description: 'Build your first assessment',
      icon: FileText,
      completed: (dashboardData?.stats?.totalExams || 0) > 0,
      action: () => setShowCreateExamModal(true)
    }
  ];

  const instituteFeatures = [
    { id: 'students', title: 'Student Management', description: 'Add, import, and manage student profiles with DPDP compliance', icon: Users },
    { id: 'exams', title: 'Exam Builder', description: 'Create exams with MCQ, auto-grading, and question banks', icon: FileText, isNew: true },
    { id: 'batches', title: 'Batch Organization', description: 'Organize students into classes and sections', icon: Layers },
    { id: 'analytics', title: 'Performance Analytics', description: 'Track scores, trends, and identify at-risk students', icon: BarChart3, isPro: true },
    { id: 'enrollments', title: 'Enrollment Management', description: 'Approve and manage student enrollments', icon: UserPlus },
    { id: 'reports', title: 'Reports & Exports', description: 'Generate and download comprehensive reports', icon: ClipboardList },
    { id: 'lbi', title: 'Behavioral Insights', description: 'LBI assessments for holistic student development', icon: Activity, isPro: true },
    { id: 'compliance', title: 'DPDP Compliance', description: 'Built-in data protection and consent management', icon: Shield }
  ];

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const [response, user] = await Promise.all([
        fetch('/api/institute/dashboard', { credentials: 'include' }),
        fetchUser().catch(() => null)
      ]);
      if (!response.ok) throw new Error('Failed to load dashboard');
      const data = await response.json();
      setDashboardData(data);
      if (user) setUserData(user);
      if (shouldShowTour('institute')) setShowTour(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load dashboard",
        variant: "destructive"
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

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (activeSection === 'analytics') {
      fetchAnalytics();
    }
  }, [activeSection]);

  // Polling for real-time updates when on analytics view
  useEffect(() => {
    if (activeSection !== 'analytics') return;
    const interval = setInterval(() => {
      fetchAnalytics(true);
    }, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [activeSection]);

  const fetchAnalytics = async (silent = false) => {
    try {
      if (!silent) setAnalyticsLoading(true);
      const res = await fetch('/api/institute/analytics', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
        setAnalyticsLastRefresh(new Date());
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      if (!silent) setAnalyticsLoading(false);
    }
  };

  const handleEnrollmentAction = async (enrollmentId: string, status: 'Approved' | 'Rejected') => {
    try {
      const response = await fetch(`/api/institute/enrollments/${enrollmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status })
      });
      if (!response.ok) throw new Error('Failed to update enrollment');
      
      toast({
        title: "Success",
        description: `Enrollment ${status.toLowerCase()} successfully`
      });
      loadDashboard();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleExamStatusChange = async (examId: string, status: string) => {
    try {
      const response = await fetch(`/api/institute/exams/${examId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status })
      });
      if (!response.ok) throw new Error('Failed to update exam status');
      
      toast({
        title: "Success",
        description: `Exam status updated to ${status}`
      });
      loadDashboard();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
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

  const handleCreateBatch = async () => {
    if (!batchForm.batchCode || !batchForm.batchName || !batchForm.academicYear) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/institute/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(batchForm)
      });
      if (!response.ok) throw new Error('Failed to create batch');
      toast({ title: "Success", description: "Batch created successfully" });
      setShowCreateBatchModal(false);
      setBatchForm({ batchCode: '', batchName: '', academicYear: '2025-26', status: 'Active' });
      loadDashboard();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkImport = async () => {
    if (csvData.length === 0) {
      toast({ title: "Error", description: "No data to import", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/institute/batches/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ batches: csvData })
      });
      if (!response.ok) throw new Error('Failed to import batches');
      const result = await response.json();
      toast({ title: "Success", description: result.message });
      setShowCreateBatchModal(false);
      setCsvData([]);
      loadDashboard();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const batchCodeIdx = headers.findIndex(h => h.includes('code') || h === 'batchcode');
      const batchNameIdx = headers.findIndex(h => h.includes('name') || h === 'batchname');
      const academicYearIdx = headers.findIndex(h => h.includes('year') || h === 'academicyear');
      const statusIdx = headers.findIndex(h => h.includes('status'));

      const parsed = lines.slice(1).map(line => {
        const cols = line.split(',').map(c => c.trim());
        return {
          batchCode: cols[batchCodeIdx] || '',
          batchName: cols[batchNameIdx] || '',
          academicYear: cols[academicYearIdx] || '2025-26',
          status: cols[statusIdx] || 'Active'
        };
      }).filter(b => b.batchCode && b.batchName);

      setCsvData(parsed);
      toast({ title: "File Loaded", description: `${parsed.length} batches ready to import` });
    };
    reader.readAsText(file);
  };

  const handleCreateExam = async () => {
    if (!examForm.examCode || !examForm.examName) {
      toast({ title: "Error", description: "Please fill in exam code and name", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const submissionData = { ...examForm };
    if (instituteRole === 'teacher') {
      if (submissionData.status !== 'Draft' && submissionData.status !== 'Pending Approval') {
        submissionData.status = 'Draft';
      }
    }
    try {
      const response = await fetch('/api/institute/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(submissionData)
      });
      if (!response.ok) throw new Error('Failed to create exam');
      const successMsg = instituteRole === 'teacher' && submissionData.status === 'Pending Approval'
        ? "Exam submitted for principal approval"
        : "Exam created successfully";
      toast({ title: "Success", description: successMsg });
      setShowCreateExamModal(false);
      setExamForm({ 
        examCode: '', examName: '', batchId: '', startAt: '', endAt: '', status: 'Draft',
        subject: '', classGrade: '', examType: 'Unit Test', duration: '60',
        totalMarks: '100', passingMarks: '35', negativeMarking: false, negativeMarkValue: '0.25',
        questionFormats: ['MCQ'] as string[], difficulty: 'Medium',
        shuffleQuestions: false, shuffleOptions: false,
        allowLateSubmission: false, gracePeriod: '15',
        instructions: 'Read all questions carefully before answering.\nAll questions are compulsory unless stated otherwise.\nUse of electronic devices is not permitted.',
        calculatorAllowed: false, referenceMaterial: false,
        createdBy: 'Teacher', approvalNote: ''
      });
      setAiGeneratedQuestions([]);
      setAiGenTopic('');
      loadDashboard();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExamFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const codeIdx = headers.findIndex(h => h.includes('code') || h === 'examcode');
      const nameIdx = headers.findIndex(h => h.includes('name') || h === 'examname');
      const subjectIdx = headers.findIndex(h => h.includes('subject'));
      const classIdx = headers.findIndex(h => h.includes('class') || h.includes('grade'));
      const durationIdx = headers.findIndex(h => h.includes('duration'));
      const marksIdx = headers.findIndex(h => h.includes('marks') || h.includes('totalmarks'));
      const parsed = lines.slice(1).map(line => {
        const cols = line.split(',').map(c => c.trim());
        return {
          examCode: cols[codeIdx] || '',
          examName: cols[nameIdx] || '',
          subject: cols[subjectIdx] || '',
          class: cols[classIdx] || '',
          duration: cols[durationIdx] || '',
          totalMarks: cols[marksIdx] || ''
        };
      }).filter(e => e.examCode && e.examName);
      setExamCsvData(parsed);
      toast({ title: "File Loaded", description: `${parsed.length} exams ready to import` });
    };
    reader.readAsText(file);
  };

  const handleBulkExamImport = async () => {
    if (examCsvData.length === 0) {
      toast({ title: "Error", description: "No data to import", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/institute/exams/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ exams: examCsvData })
      });
      if (!response.ok) throw new Error('Failed to import exams');
      const result = await response.json();
      toast({ title: "Success", description: result.message || `${examCsvData.length} exams imported` });
      setShowImportExamModal(false);
      setExamCsvData([]);
      loadDashboard();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAIGenerate = async () => {
    if (!aiGenTopic) return;
    setAiGenerating(true);
    try {
      const res = await fetch('/api/ai/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: aiGenTopic, count: parseInt(aiGenCount), difficulty: aiGenDifficulty, subject: examForm.subject, classGrade: examForm.classGrade })
      });
      if (res.ok) {
        const data = await res.json();
        setAiGeneratedQuestions(data.questions || []);
      } else {
        setAiGeneratedQuestions(Array.from({length: parseInt(aiGenCount)}, (_, i) => ({
          question: `Sample Q${i+1}: ${aiGenTopic} related question (${aiGenDifficulty})`,
          optionA: 'Option A', optionB: 'Option B', optionC: 'Option C', optionD: 'Option D', answer: 'A'
        })));
      }
    } catch {
      setAiGeneratedQuestions(Array.from({length: parseInt(aiGenCount)}, (_, i) => ({
        question: `Sample Q${i+1}: ${aiGenTopic} related question (${aiGenDifficulty})`,
        optionA: 'Option A', optionB: 'Option B', optionC: 'Option C', optionD: 'Option D', answer: 'A'
      })));
    }
    setAiGenerating(false);
  };

  const openQuestionBuilder = async (exam: Exam) => {
    setSelectedExamForQuestions(exam);
    setShowQuestionBuilderModal(true);
    try {
      const response = await fetch(`/api/institute/exams/${exam.id}/questions`, { credentials: 'include' });
      if (response.ok) {
        const questions = await response.json();
        setExamQuestions(questions);
      }
    } catch (error) {
      console.error('Failed to load questions', error);
    }
  };

  const handleAddQuestion = async () => {
    if (!selectedExamForQuestions || !newQuestion.questionText || !newQuestion.optionA || !newQuestion.optionB) {
      toast({ title: "Error", description: "Please fill in question text and at least options A and B", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/institute/exams/${selectedExamForQuestions.id}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newQuestion)
      });
      if (!response.ok) throw new Error('Failed to add question');
      const question = await response.json();
      setExamQuestions([...examQuestions, question]);
      setNewQuestion({ questionText: '', optionA: '', optionB: '', optionC: '', optionD: '', correctOption: 'A', marks: 1 });
      toast({ title: "Success", description: "Question added" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!selectedExamForQuestions) return;
    try {
      await fetch(`/api/institute/exams/${selectedExamForQuestions.id}/questions/${questionId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      setExamQuestions(examQuestions.filter(q => q.id !== questionId));
      toast({ title: "Deleted", description: "Question removed" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleAddStudent = async () => {
    if (!studentForm.studentCode || !studentForm.fullName) {
      toast({ title: "Error", description: "Please fill in student code and name", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/institute/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(studentForm)
      });
      if (!response.ok) throw new Error('Failed to add student');
      toast({ title: "Success", description: "Student added successfully" });
      setShowAddStudentModal(false);
      setStudentForm({ studentCode: '', fullName: '', dob: '', status: 'Active' });
      loadDashboard();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkStudentImport = async () => {
    if (studentCsvData.length === 0) {
      toast({ title: "Error", description: "No data to import", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/institute/students/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ students: studentCsvData })
      });
      if (!response.ok) throw new Error('Failed to import students');
      const result = await response.json();
      toast({ title: "Success", description: result.message });
      setShowAddStudentModal(false);
      setStudentCsvData([]);
      loadDashboard();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStudentFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const codeIdx = headers.findIndex(h => h.includes('code') || h === 'studentcode');
      const nameIdx = headers.findIndex(h => h.includes('name') || h === 'fullname');
      const dobIdx = headers.findIndex(h => h.includes('dob') || h.includes('birth'));
      const statusIdx = headers.findIndex(h => h.includes('status'));

      const parsed = lines.slice(1).map(line => {
        const cols = line.split(',').map(c => c.trim());
        return {
          studentCode: cols[codeIdx] || '',
          fullName: cols[nameIdx] || '',
          dob: cols[dobIdx] || '',
          status: cols[statusIdx] || 'Active'
        };
      }).filter(s => s.studentCode && s.fullName);

      setStudentCsvData(parsed);
      toast({ title: "File Loaded", description: `${parsed.length} students ready to import` });
    };
    reader.readAsText(file);
  };

  const handleUpdateProfile = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/institute/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(profileForm)
      });
      if (!response.ok) throw new Error('Failed to update profile');
      toast({ title: "Success", description: "Profile updated successfully" });
      setShowProfileModal(false);
      loadDashboard();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportData = () => {
    const data = activeSection === 'students' ? stats.totalStudents : 
                 activeSection === 'exams' ? exams :
                 activeSection === 'batches' ? batches :
                 activeSection === 'enrollments' ? enrollments : null;
    
    if (!data) {
      toast({ title: "Export", description: "No data to export for this section" });
      return;
    }

    let csvContent = '';
    let filename = '';
    
    if (activeSection === 'exams' && Array.isArray(exams)) {
      csvContent = 'Exam Code,Exam Name,Status,Start Date,End Date\n';
      exams.forEach(e => {
        csvContent += `${e.examCode},${e.examName},${e.status},${e.startAt},${e.endAt}\n`;
      });
      filename = 'exams_export.csv';
    } else if (activeSection === 'batches' && Array.isArray(batches)) {
      csvContent = 'Batch Code,Batch Name,Academic Year,Status\n';
      batches.forEach(b => {
        csvContent += `${b.batchCode},${b.batchName},${b.academicYear},${b.status}\n`;
      });
      filename = 'batches_export.csv';
    } else if (activeSection === 'enrollments' && Array.isArray(enrollments)) {
      csvContent = 'Student Name,Batch Name,Status,Requested On\n';
      enrollments.forEach(e => {
        csvContent += `${e.studentName},${e.batchName},${e.status},${e.requestedOn}\n`;
      });
      filename = 'enrollments_export.csv';
    } else {
      csvContent = 'Section,Value\n';
      csvContent += `Total Students,${stats.totalStudents}\n`;
      csvContent += `Total Exams,${stats.totalExams}\n`;
      csvContent += `Active Exams,${stats.activeExams}\n`;
      csvContent += `Pending Enrollments,${stats.pendingEnrollments}\n`;
      filename = 'overview_export.csv';
    }

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export", description: `Downloaded ${filename}` });
  };

  const openProfileModal = () => {
    setProfileForm({
      displayName: institute?.displayName || '',
      legalName: institute?.legalName || ''
    });
    setShowProfileModal(true);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const { institute, stats, enrollments, exams, batches } = dashboardData || {
    institute: null,
    stats: { totalStudents: 0, totalExams: 0, pendingEnrollments: 0, activeExams: 0 },
    enrollments: [],
    exams: [],
    batches: []
  };

  const menuItems = [
    { id: 'overview',            label: 'Overview',            icon: BarChart3,     section: 'main' },
    { id: 'students',            label: 'Students',            icon: Users,         section: 'main' },
    { id: 'exams',               label: 'Exams',               icon: FileText,      section: 'main' },
    { id: 'batches',             label: 'Batches',             icon: Layers,        section: 'main' },
    { id: 'enrollments',         label: 'Enrollments',         icon: UserPlus,      section: 'main' },
    { id: 'analytics',           label: 'Live Analytics',      icon: PieChart,      section: 'main', badge: 'Live' },
    { id: 'reports',             label: 'Reports',             icon: ClipboardList, section: 'main' },
    { id: 'lbi-product',         label: 'Behavior Assessment', icon: Brain,         section: 'main' },
    { id: 'exam-ready',          label: 'Exam Readiness',      icon: Target,        section: 'main', badge: 'New' },
    { id: 'ai-powered-reports',  label: 'AI Reports',          icon: Sparkles,      section: 'main' },
    { id: 'metryxai-assistant',  label: 'Ask MetryxAI',        icon: MessageCircle, section: 'main' },
    { id: 'education',           label: 'Education Plans',     icon: BookOpen,      section: 'main' },
    { id: 'packages',            label: 'LBI Packages',        icon: Award,         section: 'main' },
    { id: 'talent',              label: 'Talent & HR',         icon: GraduationCap, section: 'main', badge: 'New' },
    { id: 'school-health',       label: 'School Health',       icon: Activity,      section: 'main', badge: 'New' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col font-['Inter',sans-serif]">
        <InstituteHeader 
          instituteName={institute?.displayName}
          instituteCode={institute?.instituteCode}
          onLogout={handleLogout}
          onSearchOpen={() => setShowSearch(true)}
          notificationCount={stats?.pendingEnrollments || 0}
          currentRole={userData?.role}
          availableRoles={userData?.roles}
          onRoleChange={handleRoleChange}
          activeSection={activeSection}
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
          onTour={() => setShowTour(true)}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3" style={{ color: brand.primary }} />
            <p className="text-sm text-gray-500">Loading dashboard...</p>
          </div>
        </div>
        <InstituteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-['Inter',sans-serif]">
      <InstituteHeader 
        instituteName={institute?.displayName}
        instituteCode={institute?.instituteCode}
        onLogout={handleLogout}
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        onProfileClick={openProfileModal}
        onSettingsClick={() => setShowSettingsModal(true)}
        onSearchOpen={() => setShowSearch(true)}
        notificationCount={stats?.pendingEnrollments || 0}
        currentRole={userData?.role}
        availableRoles={userData?.roles}
        onRoleChange={handleRoleChange}
        activeSection={activeSection}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        onTour={() => setShowTour(true)}
      />

      <div className="flex-1 flex">
        <div className="flex-1 flex max-w-[1400px] mx-auto w-full px-4 py-6 gap-6">
        {/* Sidebar */}
        <aside className={`shrink-0 transition-all duration-300 hidden md:block ${sidebarOpen ? 'w-56' : 'w-14'}`}>
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden sticky top-6">

          {/* Institute card */}
          {sidebarOpen && (
            <div className="px-4 py-4 border-b border-gray-100">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold mb-2"
                style={{ background: '#0B3C5D' }}>
                {(institute?.displayName || 'I').charAt(0).toUpperCase()}
              </div>
              <div className="text-xs font-semibold text-gray-800 truncate">
                {institute?.displayName || 'Institute'}
              </div>
              <div className="text-[10px] text-gray-400 truncate">
                {institute?.instituteCode || 'Portal'} &nbsp;·&nbsp; {stats.totalStudents} students
              </div>
              {/* Progress bar */}
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{
                    width: `${Math.min((stats.activeExams / Math.max(stats.totalExams, 1)) * 100, 100)}%`,
                    backgroundColor: brand.accent
                  }} />
                </div>
                <span className="text-[9px] text-gray-400">{stats.activeExams}/{stats.totalExams}</span>
              </div>
            </div>
          )}

          <nav className="p-2 space-y-0.5">
            {menuItems.map(item => {
              if (item.section === 'divider') {
                return sidebarOpen ? (
                  <div key={item.id} className="pt-4 pb-1 px-3" data-testid={`section-header-${item.label.toLowerCase()}`}>
                    <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">{item.label}</span>
                  </div>
                ) : (
                  <div key={item.id} className="pt-2 pb-1 px-2">
                    <div className="h-px bg-gray-100" />
                  </div>
                );
              }

              const isActive = activeSection === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  title={!sidebarOpen ? item.label : undefined}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                  } ${!sidebarOpen ? 'justify-center' : ''}`}
                  style={isActive ? { backgroundColor: brand.primary } : {}}
                  data-testid={`nav-${item.id}`}
                >
                  <span className="shrink-0">{item.icon && <item.icon size={16} />}</span>
                  {sidebarOpen && <span className="flex-1 text-left">{item.label}</span>}
                  {sidebarOpen && item.badge && (
                    <span className="px-1.5 py-0.5 text-[8px] rounded-full text-white" style={{ backgroundColor: item.badge === 'Live' ? '#4ECDC4' : item.badge === 'New' ? '#f59e0b' : brand.accent }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar bottom actions */}
          <div className="p-2 border-t border-gray-100 space-y-0.5">
            <button
              onClick={() => setShowTour(true)}
              title={!sidebarOpen ? 'Quick Tour' : undefined}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs hover:bg-gray-50 transition-colors ${!sidebarOpen ? 'justify-center' : ''}`}
              style={{ color: '#4ECDC4' }}
            >
              <Play size={15} />
              {sidebarOpen && <span className="font-medium">Quick Tour</span>}
            </button>
            <button onClick={() => setShowHelpCenter(true)}
              title={!sidebarOpen ? 'Help & Support' : undefined}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600 ${!sidebarOpen ? 'justify-center' : ''}`}>
              <HelpCircle size={16} />
              {sidebarOpen && <span>Help & Support</span>}
            </button>
            <button onClick={loadDashboard}
              title={!sidebarOpen ? 'Refresh' : undefined}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600 ${!sidebarOpen ? 'justify-center' : ''}`}>
              <RefreshCw size={16} />
              {sidebarOpen && <span>Refresh</span>}
            </button>
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600 ${!sidebarOpen ? 'justify-center' : ''}`}>
              <ChevronRight size={16} className={`transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} />
              {sidebarOpen && <span>Collapse</span>}
            </button>
            <button onClick={handleLogout}
              title={!sidebarOpen ? 'Sign Out' : undefined}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-400 hover:bg-red-50 hover:text-red-500 ${!sidebarOpen ? 'justify-center' : ''}`}
              data-testid="btn-logout">
              <LogOut size={16} />
              {sidebarOpen && <span>Sign Out</span>}
            </button>
          </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                {menuItems.find(m => m.id === activeSection)?.label || 'Dashboard'}
              </h1>
              <p className="text-xs text-gray-500">
                Welcome back, {institute?.displayName || 'Institute'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input 
                  placeholder="Search..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs w-48"
                  data-testid="input-search"
                />
              </div>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1" data-testid="btn-filter">
                <Filter size={12} /> Filter
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={handleExportData} data-testid="btn-export">
                <Download size={12} /> Export
              </Button>
              <Button 
                size="sm" 
                className="h-8 text-xs gap-1 text-white"
                style={{ backgroundColor: brand.primary }}
                onClick={loadDashboard}
                data-testid="btn-refresh"
              >
                <RefreshCw size={12} /> Refresh
              </Button>
            </div>
          </div>

          {/* Overview Section */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              {/* Welcome Banner with Quick Actions */}
              <Card className="border-0 shadow-lg overflow-hidden" style={{ backgroundColor: brand.primary }}>
                <CardContent className="p-6 text-white">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles size={20} />
                        <span className="text-sm font-medium opacity-90">Enterprise Dashboard</span>
                      </div>
                      <h2 className="text-xl font-bold mb-1">Welcome to MetryxOne Institute Portal</h2>
                      <p className="text-white/80 text-sm">Your unified platform for academic excellence and student success</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCreateExamModal(true)}
                        data-testid="btn-quick-create-exam"
                      >
                        <Plus size={14} className="mr-1" /> Create Exam
                      </Button>
                      <Button 
                        className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddStudentModal(true)}
                        data-testid="btn-quick-add-student"
                      >
                        <UserPlus size={14} className="mr-1" /> Add Student
                      </Button>
                      <Button 
                        className="bg-white text-gray-800 hover:bg-gray-100"
                        size="sm"
                        onClick={() => setShowHelpCenter(true)}
                        data-testid="btn-get-started"
                      >
                        <HelpCircle size={14} className="mr-1" /> Get Help
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* CAPADEX 3.0 Phase 1.4 GAP-J1 — teacher/counsellor continuation.
                  Renders nothing unless customer_journey_completion (+ journey-tail) is ON → byte-identical absent OFF. */}
              <ObservationFollowUpQueue />

              {/* Quick Start Guide (shown until all steps completed) */}
              {showQuickStart && !quickStartItems.every(i => i.completed) && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <QuickStartGuide
                      title="Quick Start Guide"
                      subtitle="Complete these steps to get the most out of MetryxOne"
                      items={quickStartItems}
                      onDismiss={() => setShowQuickStart(false)}
                    />
                  </div>
                  <div className="space-y-4">
                    <SupportContact />
                  </div>
                </div>
              )}

              {/* Feature Highlights */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap size={18} style={{ color: brand.accent }} />
                    <h3 className="font-semibold text-sm" style={{ color: brand.primary }}>Self-Service Features</h3>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowHelpCenter(true)}>
                    View All Features <ChevronRight size={14} />
                  </Button>
                </div>
                <FeatureHighlights 
                  features={instituteFeatures}
                  onFeatureClick={(feature) => {
                    if (feature.id === 'students') setActiveSection('students');
                    else if (feature.id === 'exams') setActiveSection('exams');
                    else if (feature.id === 'batches') setActiveSection('batches');
                    else if (feature.id === 'analytics') setActiveSection('analytics');
                    else if (feature.id === 'enrollments') setActiveSection('enrollments');
                    else if (feature.id === 'reports') setActiveSection('reports');
                  }}
                />
              </div>

              {/* KPI Cards Row 1 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPICard 
                  title="Total Students"
                  value={stats.totalStudents}
                  icon={Users}
                  trend={12}
                  trendLabel="vs last month"
                  color={brand.primary}
                />
                <KPICard 
                  title="Total Exams"
                  value={stats.totalExams}
                  icon={FileText}
                  trend={8}
                  trendLabel="vs last month"
                  color="#0B3C5D"
                />
                <KPICard 
                  title="Active Exams"
                  value={stats.activeExams}
                  icon={Play}
                  trend={-5}
                  trendLabel="vs last week"
                  color={brand.accent}
                />
                <KPICard 
                  title="Pending Enrollments"
                  value={stats.pendingEnrollments}
                  icon={Clock}
                  trend={0}
                  trendLabel="requires action"
                  color="#F59E0B"
                  alert={stats.pendingEnrollments > 0}
                />
              </div>

              {/* KPI Cards Row 2 - Additional Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPICard 
                  title="Active Batches"
                  value={batches.filter(b => b.status === 'Active').length}
                  icon={Layers}
                  color="#0B3C5D"
                />
                <KPICard 
                  title="Avg Score"
                  value="78%"
                  icon={Target}
                  trend={3}
                  trendLabel="improvement"
                  color="#4ECDC4"
                />
                <KPICard 
                  title="Pass Rate"
                  value="92%"
                  icon={Award}
                  trend={2}
                  trendLabel="vs last term"
                  color="#4ECDC4"
                />
                <KPICard 
                  title="Completion Rate"
                  value="88%"
                  icon={CheckCircle}
                  trend={5}
                  trendLabel="on-time"
                  color="#4ECDC4"
                />
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pending Enrollments */}
                <Card className="border border-gray-100 rounded-2xl shadow-sm">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold">Pending Enrollments</CardTitle>
                      <p className="text-[10px] text-gray-500 mt-0.5">{enrollments.filter(e => e.status === 'Pending').length} awaiting approval</p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs" style={{ color: brand.primary }}>
                      View All <ChevronRight size={14} />
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {enrollments.filter(e => e.status === 'Pending').length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <CheckCircle size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-xs">No pending enrollments</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {enrollments.filter(e => e.status === 'Pending').slice(0, 4).map(enrollment => (
                          <div 
                            key={enrollment.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                            data-testid={`enrollment-row-${enrollment.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <div 
                                className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                style={{ backgroundColor: brand.primary }}
                              >
                                {enrollment.studentName.charAt(0)}
                              </div>
                              <div>
                                <p className="text-xs font-medium text-gray-900">{enrollment.studentName}</p>
                                <p className="text-[10px] text-gray-500">{enrollment.batchName} · {formatDate(enrollment.requestedOn)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button 
                                size="sm" 
                                variant="ghost"
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => handleEnrollmentAction(enrollment.id, 'Rejected')}
                                data-testid={`btn-reject-${enrollment.id}`}
                              >
                                <XCircle size={16} />
                              </Button>
                              <Button 
                                size="sm" 
                                className="h-7 w-7 p-0 text-white"
                                style={{ backgroundColor: brand.accent }}
                                onClick={() => handleEnrollmentAction(enrollment.id, 'Approved')}
                                data-testid={`btn-approve-${enrollment.id}`}
                              >
                                <CheckCircle size={16} />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Exams */}
                <Card className="border border-gray-100 rounded-2xl shadow-sm">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold">Recent Exams</CardTitle>
                      <p className="text-[10px] text-gray-500 mt-0.5">{exams.length} total exams</p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs" style={{ color: brand.primary }}>
                      View All <ChevronRight size={14} />
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {exams.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <FileText size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-xs">No exams created yet</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {exams.slice(0, 4).map(exam => (
                          <div 
                            key={exam.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                            data-testid={`exam-row-${exam.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <div 
                                className="h-8 w-8 rounded-xl flex items-center justify-center"
                                style={{ backgroundColor: `${brand.primary}15`, color: brand.primary }}
                              >
                                <BookOpen size={16} />
                              </div>
                              <div>
                                <p className="text-xs font-medium text-gray-900">{exam.examName}</p>
                                <p className="text-[10px] text-gray-500">{exam.examCode} · {formatDateTime(exam.startAt)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <ExamStatusBadge status={exam.status} />
                              <Button 
                                size="sm" 
                                variant="ghost"
                                className="h-7 w-7 p-0"
                              >
                                <MoreVertical size={14} className="text-gray-400" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Batches Overview */}
              <Card className="border border-gray-100 rounded-2xl shadow-sm">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold">Batches Overview</CardTitle>
                    <p className="text-[10px] text-gray-500 mt-0.5">{batches.length} batches configured</p>
                  </div>
                  <Button size="sm" className="h-8 text-xs text-white" style={{ backgroundColor: brand.primary }} onClick={() => setShowCreateBatchModal(true)} data-testid="btn-create-batch-overview">
                    + Create Batch
                  </Button>
                </CardHeader>
                <CardContent className="pt-0">
                  {batches.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Layers size={32} className="mx-auto mb-2 opacity-50" />
                      <p className="text-xs">No batches created yet</p>
                      <Button size="sm" className="mt-3 text-xs" style={{ backgroundColor: brand.primary, color: 'white' }} onClick={() => setShowCreateBatchModal(true)} data-testid="btn-create-first-batch">
                        Create First Batch
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left py-2 px-3 font-medium text-gray-500">Batch</th>
                            <th className="text-left py-2 px-3 font-medium text-gray-500">Academic Year</th>
                            <th className="text-left py-2 px-3 font-medium text-gray-500">Status</th>
                            <th className="text-right py-2 px-3 font-medium text-gray-500">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batches.map(batch => (
                            <tr key={batch.id} className="border-b border-gray-50 hover:bg-gray-50" data-testid={`batch-row-${batch.id}`}>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="h-7 w-7 rounded flex items-center justify-center"
                                    style={{ backgroundColor: `${brand.accent}15`, color: brand.accent }}
                                  >
                                    <GraduationCap size={14} />
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900">{batch.batchName}</p>
                                    <p className="text-[10px] text-gray-500">{batch.batchCode}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-gray-600">{batch.academicYear}</td>
                              <td className="py-2.5 px-3">
                                <BatchStatusBadge status={batch.status} />
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <Button variant="ghost" size="sm" className="h-7 text-xs" style={{ color: brand.primary }}>
                                  <Eye size={14} className="mr-1" /> View
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Performance Analytics */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="border border-gray-100 rounded-2xl shadow-sm lg:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Performance Trends</CardTitle>
                    <p className="text-[10px] text-gray-500 mt-0.5">Average scores over time</p>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48 flex items-center justify-center bg-gray-50 rounded-xl">
                      <div className="text-center text-gray-400">
                        <Activity size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-xs">Performance chart will appear here</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-gray-100 rounded-2xl shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Subject Distribution</CardTitle>
                    <p className="text-[10px] text-gray-500 mt-0.5">Exams by subject</p>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48 flex items-center justify-center bg-gray-50 rounded-xl">
                      <div className="text-center text-gray-400">
                        <PieChart size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-xs">Distribution chart</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Students Section */}
          {activeSection === 'students' && (
            <div className="space-y-6">
              {/* Header Card */}
              <Card className="border border-gray-100 rounded-2xl shadow-sm" style={{ backgroundColor: brand.primary }}>
                <CardContent className="p-6 text-white">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold mb-1">Student Management</h2>
                      <p className="text-white/80 text-sm">{stats.totalStudents} enrolled students across {batches.length} batches</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        className="bg-white/20 hover:bg-white/30 text-white border-white/30 gap-2"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddStudentModal(true)}
                        data-testid="btn-add-student"
                      >
                        <Plus size={16} /> Add Student
                      </Button>
                      <Button 
                        className="bg-white/20 hover:bg-white/30 text-white border-white/30 gap-2"
                        variant="outline"
                        size="sm"
                        data-testid="btn-import-students"
                      >
                        <Upload size={16} /> Import CSV
                      </Button>
                      <Button 
                        className="bg-white/20 hover:bg-white/30 text-white border-white/30 gap-2"
                        variant="outline"
                        size="sm"
                        data-testid="btn-export-students"
                      >
                        <Download size={16} /> Export
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${brand.primary}15` }}>
                    <Users size={20} style={{ color: brand.primary }} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalStudents}</p>
                    <p className="text-xs text-gray-500">Total Students</p>
                  </div>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-teal-500/15">
                    <CheckCircle size={20} className="text-teal-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalStudents}</p>
                    <p className="text-xs text-gray-500">Active</p>
                  </div>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-amber-500/15">
                    <Clock size={20} className="text-amber-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{stats.pendingEnrollments}</p>
                    <p className="text-xs text-gray-500">Pending</p>
                  </div>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${brand.accent}15` }}>
                    <Layers size={20} style={{ color: brand.accent }} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{batches.length}</p>
                    <p className="text-xs text-gray-500">Batches</p>
                  </div>
                </div>
              </div>

              {/* Students by Batch */}
              {batches.length > 0 ? (
                <div className="space-y-4">
                  {batches.map(batch => (
                    <Card key={batch.id} className="border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                      <div className="h-1 w-full" style={{ backgroundColor: brand.accent }} />
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div 
                              className="h-10 w-10 rounded-xl flex items-center justify-center"
                              style={{ backgroundColor: `${brand.accent}15`, color: brand.accent }}
                            >
                              <Layers size={20} />
                            </div>
                            <div>
                              <CardTitle className="text-base font-semibold">{batch.batchName}</CardTitle>
                              <p className="text-xs text-gray-500">{batch.batchCode} • {batch.academicYear}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge 
                              className={batch.status === 'Active' ? 'bg-teal-500/15 text-teal-600' : 'bg-gray-500/15 text-gray-600'}
                            >
                              {batch.status}
                            </Badge>
                            <Button variant="outline" size="sm" className="h-8 text-xs gap-1" data-testid={`btn-add-to-batch-${batch.id}`}>
                              <UserPlus size={14} /> Add Student
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-2">
                        {/* Sample student list - in real app this would be filtered by batch */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-100">
                                <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs">Student</th>
                                <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs">Grade/Class</th>
                                <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs">Status</th>
                                <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs">Avg Score</th>
                                <th className="text-right py-3 px-4 font-medium text-gray-500 text-xs">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {/* Sample students - would be populated from API */}
                              {[
                                { id: '1', name: 'Aarav Sharma', grade: 'Grade 10', status: 'Active', avgScore: 85 },
                                { id: '2', name: 'Priya Patel', grade: 'Grade 10', status: 'Active', avgScore: 92 },
                                { id: '3', name: 'Rahul Kumar', grade: 'Grade 10', status: 'Active', avgScore: 78 },
                              ].map(student => (
                                <tr key={student.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-3">
                                      <div 
                                        className="h-9 w-9 rounded-full flex items-center justify-center text-white text-sm font-medium"
                                        style={{ backgroundColor: brand.primary }}
                                      >
                                        {student.name.split(' ').map(n => n[0]).join('')}
                                      </div>
                                      <div>
                                        <p className="font-medium text-gray-900">{student.name}</p>
                                        <p className="text-xs text-gray-500">ID: STU-{student.id.padStart(4, '0')}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className="text-gray-700">{student.grade}</span>
                                  </td>
                                  <td className="py-3 px-4">
                                    <Badge className="bg-teal-500/15 text-teal-600 text-xs">{student.status}</Badge>
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-2">
                                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div 
                                          className="h-full rounded-full"
                                          style={{ 
                                            width: `${student.avgScore}%`, 
                                            backgroundColor: student.avgScore >= 80 ? '#4ECDC4' : student.avgScore >= 60 ? brand.accent : '#f59e0b'
                                          }}
                                        />
                                      </div>
                                      <span className="text-sm font-medium text-gray-700">{student.avgScore}%</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid={`btn-view-${student.id}`}>
                                        <Eye size={16} className="text-gray-500" />
                                      </Button>
                                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid={`btn-edit-${student.id}`}>
                                        <FileText size={16} className="text-gray-500" />
                                      </Button>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid={`btn-more-${student.id}`}>
                                            <MoreVertical size={16} className="text-gray-500" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-40">
                                          <DropdownMenuItem className="text-xs">
                                            <Eye size={14} className="mr-2" /> View Profile
                                          </DropdownMenuItem>
                                          <DropdownMenuItem className="text-xs">
                                            <BarChart3 size={14} className="mr-2" /> View Analytics
                                          </DropdownMenuItem>
                                          <DropdownMenuItem className="text-xs">
                                            <FileSpreadsheet size={14} className="mr-2" /> Exam History
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem className="text-xs" onClick={() => { setSurveyStudent({ id: student.id, name: student.name }); setShowSurveyModal(true); }}>
                                            <FileText size={14} className="mr-2" style={{ color: '#4ECDC4' }} /> Behavioral Observation
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem className="text-xs text-red-600">
                                            <XCircle size={14} className="mr-2" /> Remove
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                          <p className="text-xs text-gray-500">Showing 3 students in this batch</p>
                          <Button variant="link" size="sm" className="text-xs h-auto p-0" style={{ color: brand.primary }}>
                            View All Students <ChevronRight size={14} />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="border border-gray-100 rounded-2xl shadow-sm">
                  <CardContent className="py-12">
                    <div className="text-center text-gray-400">
                      <div className="h-16 w-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: `${brand.primary}10` }}>
                        <Users size={32} style={{ color: brand.primary }} />
                      </div>
                      <p className="text-lg font-medium text-gray-700 mb-1">No Batches Created Yet</p>
                      <p className="text-sm text-gray-500 mb-4">Create a batch first, then add students to it</p>
                      <div className="flex items-center justify-center gap-3">
                        <Button 
                          size="sm" 
                          className="text-white gap-2"
                          style={{ backgroundColor: brand.primary }}
                          onClick={() => setShowCreateBatchModal(true)}
                          data-testid="btn-create-batch-empty"
                        >
                          <Layers size={16} /> Create Batch
                        </Button>
                        <Button 
                          variant="outline"
                          size="sm" 
                          className="gap-2"
                          onClick={() => setShowAddStudentModal(true)}
                          data-testid="btn-add-student-empty"
                        >
                          <Plus size={16} /> Add Student
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Exams Section */}
          {activeSection === 'exams' && (
            <div className="space-y-6">
              {/* Header Card */}
              <Card className="border border-gray-100 rounded-2xl shadow-sm" style={{ backgroundColor: brand.primary }}>
                <CardContent className="p-6 text-white">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold mb-1">Exam Management</h2>
                      <p className="text-white/80 text-sm">{stats.totalExams} total exams across all statuses</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2 bg-white/10 rounded-lg p-1">
                        <Button size="sm" className={`text-xs px-3 py-1 h-7 ${instituteRole === 'admin' ? 'bg-white text-gray-900' : 'bg-transparent text-white/70 hover:text-white'}`} onClick={() => setInstituteRole('admin')} data-testid="btn-role-admin">
                          <Shield size={12} className="mr-1" /> Admin
                        </Button>
                        <Button size="sm" className={`text-xs px-3 py-1 h-7 ${instituteRole === 'teacher' ? 'bg-white text-gray-900' : 'bg-transparent text-white/70 hover:text-white'}`} onClick={() => setInstituteRole('teacher')} data-testid="btn-role-teacher">
                          <GraduationCap size={12} className="mr-1" /> Teacher
                        </Button>
                      </div>
                      <Button 
                        className="bg-white/20 hover:bg-white/30 text-white border-white/30 gap-2"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCreateExamModal(true)}
                        data-testid="btn-create-exam"
                      >
                        <Plus size={16} /> Create Exam
                      </Button>
                      <Button 
                        className="bg-white/20 hover:bg-white/30 text-white border-white/30 gap-2"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowImportExamModal(true)}
                        data-testid="btn-import-exams"
                      >
                        <Upload size={16} /> Import
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Status Overview Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Draft', count: exams.filter(e => e.status === 'Draft').length, color: '#6b7280', icon: FileText },
                  { label: 'Pending Approval', count: 2, color: '#f59e0b', icon: Clock },
                  { label: 'Published', count: exams.filter(e => e.status === 'Active').length, color: '#4ECDC4', icon: CheckCircle },
                  { label: 'Scheduled', count: 3, color: brand.primary, icon: Calendar },
                  { label: 'In Progress', count: 1, color: brand.accent, icon: Play },
                  { label: 'Completed', count: exams.filter(e => e.status === 'Completed').length, color: '#0B3C5D', icon: Award },
                ].map(stat => (
                  <div key={stat.label} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3 cursor-pointer hover:shadow-md transition-all">
                    <div 
                      className="h-10 w-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${stat.color}15` }}
                    >
                      <stat.icon size={18} style={{ color: stat.color }} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{stat.count}</p>
                      <p className="text-[10px] text-gray-500">{stat.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pending Approvals - Admin Only */}
              {instituteRole === 'admin' && pendingApprovals.filter(pa => pa.status === 'Pending').length > 0 && (
                <Card className="border border-gray-100 rounded-2xl shadow-sm" data-testid="card-pending-approvals">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Clock size={16} className="text-amber-500" />
                        Pending Approvals
                      </CardTitle>
                      <p className="text-[10px] text-gray-500 mt-0.5">{pendingApprovals.filter(pa => pa.status === 'Pending').length} exams awaiting review</p>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left py-2 px-3 font-medium text-gray-500">Exam</th>
                            <th className="text-left py-2 px-3 font-medium text-gray-500">Subject</th>
                            <th className="text-left py-2 px-3 font-medium text-gray-500">Class</th>
                            <th className="text-left py-2 px-3 font-medium text-gray-500">Marks</th>
                            <th className="text-left py-2 px-3 font-medium text-gray-500">Submitted By</th>
                            <th className="text-left py-2 px-3 font-medium text-gray-500">Date</th>
                            <th className="text-right py-2 px-3 font-medium text-gray-500">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingApprovals.filter(pa => pa.status === 'Pending').map(pa => (
                            <tr key={pa.id} className="border-b border-gray-50 hover:bg-gray-50" data-testid={`approval-row-${pa.id}`}>
                              <td className="py-2.5 px-3 font-medium text-gray-900">{pa.examName}</td>
                              <td className="py-2.5 px-3 text-gray-600">{pa.subject}</td>
                              <td className="py-2.5 px-3 text-gray-600">{pa.classGrade}</td>
                              <td className="py-2.5 px-3 text-gray-600">{pa.totalMarks}</td>
                              <td className="py-2.5 px-3 text-gray-600">{pa.createdBy}</td>
                              <td className="py-2.5 px-3 text-gray-600">{formatDate(pa.submittedAt)}</td>
                              <td className="py-2.5 px-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs text-red-600 hover:bg-red-50"
                                    onClick={() => {
                                      setPendingApprovals(prev => prev.map(p => p.id === pa.id ? {...p, status: 'Rejected'} : p));
                                      toast({ title: "Rejected", description: `${pa.examName} has been rejected` });
                                    }}
                                    data-testid={`btn-reject-approval-${pa.id}`}
                                  >
                                    <ThumbsDown size={14} className="mr-1" /> Reject
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs text-white"
                                    style={{ backgroundColor: brand.accent }}
                                    onClick={() => {
                                      setPendingApprovals(prev => prev.map(p => p.id === pa.id ? {...p, status: 'Approved'} : p));
                                      toast({ title: "Approved", description: `${pa.examName} has been approved` });
                                    }}
                                    data-testid={`btn-approve-approval-${pa.id}`}
                                  >
                                    <ThumbsUp size={14} className="mr-1" /> Approve
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Exam List by Status */}
              {exams.length === 0 ? (
                <Card className="border border-gray-100 rounded-2xl shadow-sm">
                  <CardContent className="py-12">
                    <div className="text-center text-gray-400">
                      <div className="h-16 w-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: `${brand.primary}10` }}>
                        <FileText size={32} style={{ color: brand.primary }} />
                      </div>
                      <p className="text-lg font-medium text-gray-700 mb-1">No Exams Created Yet</p>
                      <p className="text-sm text-gray-500 mb-4">Create your first exam to start assessing students</p>
                      <Button 
                        size="sm" 
                        className="text-white gap-2"
                        style={{ backgroundColor: brand.primary }}
                        onClick={() => setShowCreateExamModal(true)}
                        data-testid="btn-create-first-exam"
                      >
                        <Plus size={16} /> Create First Exam
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {/* Sample exam cards with student status - would be grouped by status in real implementation */}
                  {[
                    { 
                      id: 'exam-1', 
                      name: 'Mathematics Mid-Term', 
                      code: 'MATH-MID-2026', 
                      status: 'Published',
                      schedule: 'Feb 15, 2026 • 10:00 AM - 12:00 PM',
                      totalStudents: 45,
                      notStarted: 12,
                      inProgress: 8,
                      completed: 25,
                      batch: 'Grade 10 - Section A'
                    },
                    { 
                      id: 'exam-2', 
                      name: 'Science Unit Test', 
                      code: 'SCI-UT-001', 
                      status: 'Pending Approval',
                      schedule: 'Feb 20, 2026 • 2:00 PM - 3:30 PM',
                      totalStudents: 38,
                      notStarted: 38,
                      inProgress: 0,
                      completed: 0,
                      batch: 'Grade 10 - Section B'
                    },
                    { 
                      id: 'exam-3', 
                      name: 'English Literature Quiz', 
                      code: 'ENG-QZ-003', 
                      status: 'Scheduled',
                      schedule: 'Mar 1, 2026 • 9:00 AM - 10:00 AM',
                      totalStudents: 42,
                      notStarted: 42,
                      inProgress: 0,
                      completed: 0,
                      batch: 'Grade 10 - Section A'
                    },
                    { 
                      id: 'exam-4', 
                      name: 'History Assessment', 
                      code: 'HIST-ASS-002', 
                      status: 'Draft',
                      schedule: 'Not scheduled',
                      totalStudents: 0,
                      notStarted: 0,
                      inProgress: 0,
                      completed: 0,
                      batch: 'Not assigned'
                    },
                    { 
                      id: 'exam-5', 
                      name: 'Physics Quarterly', 
                      code: 'PHY-QTR-001', 
                      status: 'Completed',
                      schedule: 'Jan 25, 2026 • 11:00 AM - 1:00 PM',
                      totalStudents: 40,
                      notStarted: 0,
                      inProgress: 0,
                      completed: 40,
                      batch: 'Grade 10 - Section A'
                    },
                  ].map(exam => {
                    const statusColors: Record<string, { bg: string; text: string; border: string }> = {
                      'Draft': { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
                      'Pending Approval': { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
                      'Published': { bg: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-200' },
                      'Scheduled': { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
                      'In Progress': { bg: 'bg-[rgba(78,205,196,0.10)]', text: 'text-[#4ECDC4]', border: 'border-[rgba(78,205,196,0.25)]' },
                      'Completed': { bg: 'bg-[rgba(11,60,93,0.08)]', text: 'text-[#0B3C5D]', border: 'border-[rgba(11,60,93,0.20)]' },
                    };
                    const colors = statusColors[exam.status] || statusColors['Draft'];
                    
                    return (
                      <Card key={exam.id} className="border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                        <div className="h-1 w-full" style={{ backgroundColor: exam.status === 'Published' ? '#4ECDC4' : exam.status === 'Pending Approval' ? '#f59e0b' : exam.status === 'Scheduled' ? brand.primary : exam.status === 'Completed' ? '#0B3C5D' : '#6b7280' }} />
                        <CardContent className="p-4">
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            {/* Exam Info */}
                            <div className="flex items-start gap-4 flex-1">
                              <div 
                                className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
                                style={{ backgroundColor: `${brand.primary}15`, color: brand.primary }}
                              >
                                <BookOpen size={24} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-base font-semibold text-gray-900 truncate">{exam.name}</h3>
                                  <Badge className={`${colors.bg} ${colors.text} text-[10px] shrink-0`}>{exam.status}</Badge>
                                </div>
                                <p className="text-xs text-gray-500 mb-1">{exam.code} • {exam.batch}</p>
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                  <Calendar size={12} />
                                  <span>{exam.schedule}</span>
                                </div>
                              </div>
                            </div>

                            {/* Student Status Breakdown */}
                            {exam.totalStudents > 0 && (
                              <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 rounded-xl">
                                <div className="text-center">
                                  <p className="text-lg font-bold text-gray-900">{exam.totalStudents}</p>
                                  <p className="text-[10px] text-gray-500">Total</p>
                                </div>
                                <div className="h-8 w-px bg-gray-200" />
                                <div className="flex items-center gap-3">
                                  <div className="text-center">
                                    <div className="flex items-center gap-1">
                                      <div className="h-2 w-2 rounded-full bg-gray-400" />
                                      <span className="text-sm font-semibold text-gray-700">{exam.notStarted}</span>
                                    </div>
                                    <p className="text-[9px] text-gray-500">Not Started</p>
                                  </div>
                                  <div className="text-center">
                                    <div className="flex items-center gap-1">
                                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: brand.accent }} />
                                      <span className="text-sm font-semibold text-gray-700">{exam.inProgress}</span>
                                    </div>
                                    <p className="text-[9px] text-gray-500">In Progress</p>
                                  </div>
                                  <div className="text-center">
                                    <div className="flex items-center gap-1">
                                      <div className="h-2 w-2 rounded-full bg-teal-500" />
                                      <span className="text-sm font-semibold text-gray-700">{exam.completed}</span>
                                    </div>
                                    <p className="text-[9px] text-gray-500">Completed</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-2 shrink-0">
                              {exam.status === 'Draft' && (
                                <>
                                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                                    <ClipboardList size={14} /> Add Questions
                                  </Button>
                                  <Button size="sm" className="h-8 text-xs text-white gap-1" style={{ backgroundColor: brand.accent }}>
                                    <Send size={14} /> Submit for Approval
                                  </Button>
                                </>
                              )}
                              {exam.status === 'Pending Approval' && (
                                <Badge className="bg-amber-100 text-amber-700 text-xs">Awaiting Review</Badge>
                              )}
                              {exam.status === 'Published' && (
                                <Button variant="outline" size="sm" className="h-8 text-xs gap-1" data-testid={`btn-view-students-${exam.id}`}>
                                  <Users size={14} /> View Students
                                </Button>
                              )}
                              {exam.status === 'Scheduled' && (
                                <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                                  <Calendar size={14} /> Reschedule
                                </Button>
                              )}
                              {exam.status === 'Completed' && (
                                <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                                  <BarChart3 size={14} /> View Results
                                </Button>
                              )}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreVertical size={16} className="text-gray-500" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  <DropdownMenuItem className="text-xs">
                                    <Eye size={14} className="mr-2" /> Preview Exam
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-xs">
                                    <ClipboardList size={14} className="mr-2" /> Manage Questions
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-xs">
                                    <Users size={14} className="mr-2" /> Assign Students
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-xs">
                                    <Download size={14} className="mr-2" /> Export Results
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-xs text-red-600">
                                    <XCircle size={14} className="mr-2" /> Cancel Exam
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Batches Section */}
          {activeSection === 'batches' && (
            <Card className="border border-gray-100 rounded-2xl shadow-sm">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <Layers size={16} style={{ color: brand.primary }} />
                    <CardTitle className="text-sm font-semibold text-gray-800">Batch Management</CardTitle>
                  </div>
                  <p className="text-xs text-gray-500">{batches.length} batches configured</p>
                </div>
                <Button size="sm" className="h-8 text-xs text-white gap-1" style={{ backgroundColor: brand.primary }} onClick={() => setShowCreateBatchModal(true)} data-testid="btn-create-batch-management">
                  <Plus size={12} /> Create Batch
                </Button>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {batches.map(batch => (
                    <div 
                      key={batch.id}
                      className="p-4 border border-gray-100 rounded-2xl hover:shadow-md transition-all cursor-pointer"
                      data-testid={`batch-card-${batch.id}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div 
                          className="h-10 w-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: `${brand.accent}15`, color: brand.accent }}
                        >
                          <GraduationCap size={20} />
                        </div>
                        <BatchStatusBadge status={batch.status} />
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900">{batch.batchName}</h3>
                      <p className="text-[10px] text-gray-500 mb-3">{batch.batchCode}</p>
                      <div className="flex items-center justify-between text-[10px] text-gray-500">
                        <span>Academic Year: {batch.academicYear}</span>
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" style={{ color: brand.primary }}>
                          Manage
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Enrollments Section */}
          {activeSection === 'enrollments' && (
            <Card className="border border-gray-100 rounded-2xl shadow-sm">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <UserPlus size={16} style={{ color: brand.primary }} />
                    <CardTitle className="text-sm font-semibold text-gray-800">Enrollment Requests</CardTitle>
                  </div>
                  <p className="text-xs text-gray-500">{enrollments.length} total requests</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full">{enrollments.filter(e => e.status === 'Pending').length} pending</span>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {enrollments.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <UserPlus size={48} className="mx-auto mb-3 opacity-50" />
                    <p className="text-sm font-medium text-gray-600">No Enrollment Requests</p>
                    <p className="text-xs">New enrollment requests will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {enrollments.map(enrollment => (
                      <div 
                        key={enrollment.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                        data-testid={`enrollment-card-${enrollment.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold"
                            style={{ backgroundColor: brand.primary }}
                          >
                            {enrollment.studentName.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{enrollment.studentName}</p>
                            <p className="text-xs text-gray-500">{enrollment.batchName} · Requested {formatDate(enrollment.requestedOn)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <EnrollmentStatusBadge status={enrollment.status} />
                          {enrollment.status === 'Pending' && (
                            <div className="flex items-center gap-1 ml-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => handleEnrollmentAction(enrollment.id, 'Rejected')}
                              >
                                <XCircle size={14} className="mr-1" /> Reject
                              </Button>
                              <Button 
                                size="sm" 
                                className="h-8 text-xs text-white"
                                style={{ backgroundColor: brand.accent }}
                                onClick={() => handleEnrollmentAction(enrollment.id, 'Approved')}
                              >
                                <CheckCircle size={14} className="mr-1" /> Approve
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Analytics Section */}
          {activeSection === 'analytics' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border border-gray-100 rounded-2xl shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <BarChart3 size={16} style={{ color: brand.primary }} />
                    <CardTitle className="text-sm font-semibold text-gray-800">Student Performance</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-center justify-center bg-gray-50 rounded-xl">
                    <div className="text-center text-gray-400">
                      <BarChart3 size={48} className="mx-auto mb-3 opacity-50" />
                      <p className="text-xs">Performance analytics chart</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border border-gray-100 rounded-2xl shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <PieChart size={16} style={{ color: brand.accent }} />
                    <CardTitle className="text-sm font-semibold text-gray-800">Exam Completion Rate</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-center justify-center bg-gray-50 rounded-xl">
                    <div className="text-center text-gray-400">
                      <PieChart size={48} className="mx-auto mb-3 opacity-50" />
                      <p className="text-xs">Completion rate chart</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Analytics Section */}
          {activeSection === 'analytics' && (
            <div data-testid="analytics-section">
              {/* Analytics Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity size={18} style={{ color: brand.primary }} />
                  <h2 className="text-sm font-bold text-gray-900">Real-Time Analytics</h2>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-gray-500">
                    Last updated: {analyticsLastRefresh.toLocaleTimeString()}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchAnalytics()}
                    disabled={analyticsLoading}
                    className="h-7 text-xs"
                    data-testid="btn-refresh-analytics"
                  >
                    <RefreshCw size={12} className={analyticsLoading ? 'animate-spin' : ''} />
                    <span className="ml-1">Refresh</span>
                  </Button>
                </div>
              </div>

              {analyticsLoading && !analytics ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin w-8 h-8 border-4 border-t-transparent rounded-full" style={{ borderColor: brand.primary, borderTopColor: 'transparent' }} />
                </div>
              ) : analytics ? (
                <>
                  {/* Overall Stats Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
                    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
                      <p className="text-2xl font-bold text-gray-900" data-testid="inst-analytics-students">{analytics.overallStats.totalStudents}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Total Students</p>
                    </div>
                    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
                      <p className="text-2xl font-bold" style={{ color: brand.primary }} data-testid="inst-analytics-exams">{analytics.overallStats.totalExams}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Total Exams</p>
                    </div>
                    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
                      <p className="text-2xl font-bold" style={{ color: brand.accent }} data-testid="inst-analytics-avg">{analytics.overallStats.avgScore}%</p>
                      <p className="text-xs text-gray-500 mt-0.5">Avg Score</p>
                    </div>
                    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
                      <p className="text-2xl font-bold text-blue-500" data-testid="inst-analytics-completion">{analytics.overallStats.completionRate}%</p>
                      <p className="text-xs text-gray-500 mt-0.5">Completion Rate</p>
                    </div>
                    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
                      <p className="text-2xl font-bold text-teal-500" data-testid="inst-analytics-active">{analytics.overallStats.activeStudents}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Active Students</p>
                    </div>
                  </div>

                  {/* Row 2: LineChart (2/3) + PieChart (1/3) */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                    <Card className="border border-gray-100 rounded-2xl shadow-sm lg:col-span-2">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                          <TrendingUp size={14} style={{ color: brand.accent }} />
                          Performance Trends
                        </CardTitle>
                        <p className="text-[10px] text-gray-500">Monthly average scores &amp; exam count</p>
                      </CardHeader>
                      <CardContent>
                        {analytics.performanceTrends.length > 0 ? (
                          <div data-testid="chart-performance-trends">
                            <ResponsiveContainer width="100%" height={260}>
                              <LineChart data={analytics.performanceTrends} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="date" tick={{ fontSize: 11, fontFamily: 'Inter, sans-serif' }} stroke="#9ca3af" />
                                <YAxis yAxisId="left" tick={{ fontSize: 11, fontFamily: 'Inter, sans-serif' }} stroke="#9ca3af" domain={[0, 100]} />
                                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fontFamily: 'Inter, sans-serif' }} stroke="#9ca3af" />
                                <Tooltip contentStyle={{ fontFamily: 'Inter, sans-serif', fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                                <Legend wrapperStyle={{ fontFamily: 'Inter, sans-serif', fontSize: 11 }} />
                                <Line yAxisId="left" type="monotone" dataKey="avgScore" name="Avg Score (%)" stroke="#4ECDC4" strokeWidth={2} dot={{ r: 4, fill: '#4ECDC4' }} activeDot={{ r: 6 }} />
                                <Line yAxisId="right" type="monotone" dataKey="examCount" name="Exam Count" stroke="#0B3C5D" strokeWidth={2} dot={{ r: 4, fill: '#0B3C5D' }} activeDot={{ r: 6 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No trend data yet</div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border border-gray-100 rounded-2xl shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                          <PieChart size={14} style={{ color: brand.primary }} />
                          Grade Distribution
                        </CardTitle>
                        <p className="text-[10px] text-gray-500">Students by grade</p>
                      </CardHeader>
                      <CardContent>
                        {analytics.gradeDistribution.length > 0 ? (
                          <div data-testid="chart-grade-distribution">
                            <ResponsiveContainer width="100%" height={260}>
                              <RechartsPie>
                                <Pie
                                  data={analytics.gradeDistribution}
                                  dataKey="studentCount"
                                  nameKey="grade"
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={80}
                                  label={({ grade, studentCount }) => `${grade}: ${studentCount}`}
                                  labelLine={{ stroke: '#9ca3af' }}
                                  style={{ fontFamily: 'Inter, sans-serif', fontSize: 11 }}
                                >
                                  {analytics.gradeDistribution.map((_entry, index) => (
                                    <Cell key={`cell-${index}`} fill={['#0B3C5D', '#4ECDC4', '#5B6FAA', '#7ECEC8', '#8B9DC3'][index % 5]} />
                                  ))}
                                </Pie>
                                <Tooltip contentStyle={{ fontFamily: 'Inter, sans-serif', fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                                <Legend wrapperStyle={{ fontFamily: 'Inter, sans-serif', fontSize: 11 }} />
                              </RechartsPie>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No grade data yet</div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Row 3: BarChart (1/2) + Grade Distribution Table (1/2) */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                    <Card className="border border-gray-100 rounded-2xl shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                          <BarChart3 size={14} style={{ color: brand.primary }} />
                          Subject Performance
                        </CardTitle>
                        <p className="text-[10px] text-gray-500">Average scores by subject</p>
                      </CardHeader>
                      <CardContent>
                        {analytics.subjectPerformance.length > 0 ? (
                          <div data-testid="chart-subject-performance">
                            <ResponsiveContainer width="100%" height={280}>
                              <BarChart
                                data={analytics.subjectPerformance.slice(0, 8)}
                                layout="vertical"
                                margin={{ top: 5, right: 20, left: 60, bottom: 5 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fontFamily: 'Inter, sans-serif' }} stroke="#9ca3af" />
                                <YAxis type="category" dataKey="subject" tick={{ fontSize: 11, fontFamily: 'Inter, sans-serif' }} stroke="#9ca3af" width={55} />
                                <Tooltip contentStyle={{ fontFamily: 'Inter, sans-serif', fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                                <Bar dataKey="avgScore" name="Avg Score (%)" fill="#0B3C5D" radius={[0, 4, 4, 0]} barSize={18} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No subject data yet</div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border border-gray-100 rounded-2xl shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                          <Target size={14} style={{ color: brand.accent }} />
                          Grade Distribution Details
                        </CardTitle>
                        <p className="text-[10px] text-gray-500">Breakdown by grade with average scores</p>
                      </CardHeader>
                      <CardContent>
                        {analytics.gradeDistribution.length > 0 ? (
                          <div className="overflow-auto" style={{ maxHeight: 280 }} data-testid="table-grade-distribution">
                            <table className="w-full text-xs" style={{ fontFamily: 'Inter, sans-serif' }}>
                              <thead>
                                <tr style={{ borderBottom: `2px solid ${brand.primary}` }}>
                                  <th className="text-left py-2 px-3 font-semibold text-gray-700">Grade</th>
                                  <th className="text-right py-2 px-3 font-semibold text-gray-700">Students</th>
                                  <th className="text-right py-2 px-3 font-semibold text-gray-700">Avg Score</th>
                                </tr>
                              </thead>
                              <tbody>
                                {analytics.gradeDistribution.map((item, idx) => (
                                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50" data-testid={`grade-row-${idx}`}>
                                    <td className="py-2 px-3">
                                      <div className="flex items-center gap-2">
                                        <span
                                          className="inline-block w-3 h-3 rounded-sm"
                                          style={{ backgroundColor: ['#0B3C5D', '#4ECDC4', '#5B6FAA', '#7ECEC8', '#8B9DC3'][idx % 5] }}
                                        />
                                        <span className="font-medium text-gray-900">{item.grade}</span>
                                      </div>
                                    </td>
                                    <td className="py-2 px-3 text-right font-semibold" style={{ color: brand.primary }}>{item.studentCount}</td>
                                    <td className="py-2 px-3 text-right font-semibold" style={{ color: brand.accent }}>{item.avgScore}%</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No grade data yet</div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Row 4: Top Performers + At-Risk Students */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card className="border border-gray-100 rounded-2xl shadow-sm">
                      <CardHeader className="pb-2" style={{ borderBottom: `2px solid ${brand.accent}` }}>
                        <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                          <Award size={14} style={{ color: '#f59e0b' }} />
                          Top Performers
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-3">
                        {analytics.topPerformers.length > 0 ? (
                          <div className="space-y-2" data-testid="list-top-performers">
                            {analytics.topPerformers.map((student, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 rounded-xl" style={{ backgroundColor: idx % 2 === 0 ? '#f8fafc' : '#ffffff' }} data-testid={`top-performer-${idx}`}>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                                    style={{ backgroundColor: idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : brand.primary }}
                                  >
                                    {idx + 1}
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>{student.studentName}</p>
                                    <p className="text-[10px] text-gray-500">{student.examCount} exams completed</p>
                                  </div>
                                </div>
                                <Badge className="text-white text-[10px] px-2 py-0.5" style={{ backgroundColor: brand.accent }}>
                                  {student.avgScore}%
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="h-32 flex items-center justify-center text-gray-400 text-sm">No performance data yet</div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border border-gray-100 rounded-2xl shadow-sm">
                      <CardHeader className="pb-2" style={{ borderBottom: '2px solid #ef4444' }}>
                        <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                          <AlertCircle size={14} className="text-red-500" />
                          Students Needing Attention
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-3">
                        {analytics.atRiskStudents.length > 0 ? (
                          <div className="space-y-2" data-testid="list-at-risk-students">
                            {analytics.atRiskStudents.map((student, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-red-50" data-testid={`at-risk-${idx}`}>
                                <div className="flex items-center gap-2">
                                  <div className="h-7 w-7 rounded-full bg-red-100 flex items-center justify-center">
                                    <AlertCircle size={12} className="text-red-500" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>{student.studentName}</p>
                                    <p className="text-[10px] text-gray-500">
                                      {student.concernType === 'low_score' ? 'Low average score' :
                                       student.concernType === 'low_activity' ? 'Limited activity' : 'Declining performance'}
                                    </p>
                                  </div>
                                </div>
                                <Badge variant="destructive" className="text-[10px] px-2 py-0.5">
                                  {student.avgScore}%
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
                            <div className="text-center">
                              <CheckCircle size={24} className="mx-auto mb-2 text-teal-500" />
                              <p>All students performing well!</p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <Activity size={48} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500 text-sm">No analytics data available yet</p>
                  <p className="text-gray-400 text-xs mt-1">Create exams and enroll students to see analytics</p>
                </div>
              )}
            </div>
          )}

          {/* LBI Packages Section */}
          {activeSection === 'packages' && (
            <div className="space-y-4" data-testid="packages-section">
              {/* Header Card */}
              <Card className="border-0 shadow-md overflow-hidden" style={{ backgroundColor: brand.primary }}>
                <CardContent className="py-5">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                      <Award size={24} className="text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Learning Behavior Packages</h3>
                      <p className="text-white/70 text-sm">Purchase and assign LBI assessment packages to students</p>
                    </div>
                    <div className="ml-auto">
                      <Button 
                        className="text-xs h-8 gap-1"
                        style={{ backgroundColor: brand.accent }}
                        onClick={() => onNavigate('exam-ready')}
                        data-testid="btn-browse-packages"
                      >
                        <Sparkles size={14} />
                        Browse Packages
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Sub Navigation Tabs */}
              <div className="flex gap-2 border-b pb-2">
                {[
                  { id: 'browse', label: 'Browse Packages', icon: Sparkles },
                  { id: 'bulk', label: 'Bulk Assign', icon: Upload },
                  { id: 'assigned', label: 'Assigned Packages', icon: Users },
                ].map(tab => (
                  <Button
                    key={tab.id}
                    variant="ghost"
                    size="sm"
                    className="text-xs gap-1.5"
                    style={{ 
                      backgroundColor: packageSubTab === tab.id ? `${brand.primary}15` : 'transparent',
                      color: packageSubTab === tab.id ? brand.primary : '#6b7280'
                    }}
                    onClick={() => setPackageSubTab(tab.id as 'browse' | 'bulk' | 'assigned')}
                    data-testid={`pkg-tab-${tab.id}`}
                  >
                    <tab.icon size={14} />
                    {tab.label}
                  </Button>
                ))}
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Purchased Packages', value: '0', color: brand.primary, icon: Award },
                  { label: 'Assigned to Students', value: '0', color: brand.accent, icon: Users },
                  { label: 'Assessments Completed', value: '0', color: '#4ECDC4', icon: CheckCircle },
                  { label: 'Reports Generated', value: '0', color: '#f59e0b', icon: FileText },
                ].map((stat, i) => (
                  <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${stat.color}15` }}>
                        <stat.icon size={16} style={{ color: stat.color }} />
                      </div>
                    </div>
                    <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Browse Packages Sub-Tab */}
              {packageSubTab === 'browse' && (
                <Card className="border border-gray-100 rounded-2xl shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Available Packages</CardTitle>
                    <p className="text-[10px] text-gray-500 mt-0.5">Select packages to purchase for your students</p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[
                        { name: 'ExamReadiness Index™', segment: 'Class 9-12', price: '₹1,499', domains: 11, popular: true },
                        { name: 'Mini Learning Check', segment: 'Any Class', price: '₹299', domains: 2, popular: false },
                        { name: 'Stress Check', segment: 'Any Class', price: '₹349', domains: 2, popular: false },
                        { name: 'FOUNDATION', segment: 'Class 6-8', price: '₹999', domains: 8, popular: false },
                        { name: 'PERFORMANCE', segment: 'Class 9-10', price: '₹1,199', domains: 11, popular: false },
                        { name: 'READINESS', segment: 'Class 11-12', price: '₹1,299', domains: 12, popular: false },
                      ].map((pkg, i) => (
                        <div 
                          key={i}
                          className="p-4 rounded-2xl border border-gray-100 transition-all hover:shadow-md cursor-pointer"
                          style={{ borderColor: pkg.popular ? brand.accent : '#e5e7eb', boxShadow: pkg.popular ? `0 0 0 2px ${brand.accent}` : 'none' }}
                          data-testid={`pkg-${pkg.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                        >
                          {pkg.popular && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full text-white mb-2 inline-block" style={{ backgroundColor: brand.accent }}>
                              Most Popular
                            </span>
                          )}
                          <h4 className="text-sm font-semibold" style={{ color: brand.primary }}>{pkg.name}</h4>
                          <p className="text-[10px] text-gray-500 mb-2">{pkg.segment} • {pkg.domains} domains</p>
                          <div className="flex items-center justify-between mt-3 pt-3 border-t">
                            <span className="text-lg font-bold" style={{ color: brand.primary }}>{pkg.price}</span>
                            <Button 
                              size="sm" 
                              className="text-[10px] h-6"
                              style={{ backgroundColor: pkg.popular ? brand.accent : brand.primary }}
                              onClick={() => onNavigate('exam-ready')}
                            >
                              Buy for Students
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Bulk Assign Sub-Tab */}
              {packageSubTab === 'bulk' && (
                <Card className="border border-gray-100 rounded-2xl shadow-sm" data-testid="bulk-assign-section">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Upload size={16} style={{ color: brand.accent }} />
                      Bulk Package Assignment
                    </CardTitle>
                    <p className="text-[10px] text-gray-500 mt-0.5">Assign purchased packages to multiple students at once</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 border rounded-xl">
                          <h4 className="text-sm font-semibold mb-2" style={{ color: brand.primary }}>Step 1: Select Package</h4>
                          <select className="w-full p-2 border border-gray-200 rounded-xl text-sm" data-testid="select-package-bulk">
                            <option value="">Choose a package...</option>
                            <option value="exam-readiness">ExamReadiness Index™</option>
                            <option value="foundation">FOUNDATION</option>
                            <option value="performance">PERFORMANCE</option>
                          </select>
                        </div>
                        <div className="p-4 border rounded-xl">
                          <h4 className="text-sm font-semibold mb-2" style={{ color: brand.primary }}>Step 2: Select Batch/Students</h4>
                          <select className="w-full p-2 border border-gray-200 rounded-xl text-sm" data-testid="select-batch-bulk">
                            <option value="">Choose a batch...</option>
                            <option value="all">All Students</option>
                          </select>
                        </div>
                      </div>
                      <div className="text-center py-8 border-2 border-dashed rounded-xl" style={{ borderColor: '#e5e7eb' }}>
                        <Award size={40} className="mx-auto mb-3 text-gray-300" />
                        <p className="text-gray-500 text-sm mb-1">No packages purchased yet</p>
                        <p className="text-gray-400 text-xs mb-4">Purchase packages to start assigning to students</p>
                        <Button 
                          className="text-xs"
                          style={{ backgroundColor: brand.primary }}
                          onClick={() => setPackageSubTab('browse')}
                          data-testid="btn-purchase-packages"
                        >
                          <Plus size={14} className="mr-1" />
                          Browse Packages
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Assigned Packages Sub-Tab */}
              {packageSubTab === 'assigned' && (
                <Card className="border border-gray-100 rounded-2xl shadow-sm" data-testid="assigned-packages-section">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Users size={16} style={{ color: brand.accent }} />
                      Assigned Packages
                    </CardTitle>
                    <p className="text-[10px] text-gray-500 mt-0.5">View and manage packages assigned to students</p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="relative flex-1">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <Input 
                          placeholder="Search students..." 
                          className="pl-9 text-sm h-9"
                          data-testid="search-assigned"
                        />
                      </div>
                      <select className="p-2 border border-gray-200 rounded-xl text-sm h-9" data-testid="filter-package-type">
                        <option value="all">All Packages</option>
                        <option value="exam-readiness">ExamReadiness Index™</option>
                        <option value="foundation">FOUNDATION</option>
                      </select>
                    </div>
                    <div className="text-center py-12 border-2 border-dashed rounded-xl" style={{ borderColor: '#e5e7eb' }}>
                      <Users size={40} className="mx-auto mb-3 text-gray-300" />
                      <p className="text-gray-500 text-sm mb-1">No packages assigned yet</p>
                      <p className="text-gray-400 text-xs mb-4">Assign packages to students to see them here</p>
                      <Button 
                        className="text-xs"
                        style={{ backgroundColor: brand.accent }}
                        onClick={() => setPackageSubTab('bulk')}
                        data-testid="btn-go-bulk-assign"
                      >
                        <Plus size={14} className="mr-1" />
                        Assign Packages
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Education Section */}
          {activeSection === 'education' && (
            <EducationPlanner />
          )}

          {/* Talent & HR Section */}
          {activeSection === 'talent' && (
            <div className="space-y-4" data-testid="talent-section">
              <Card className="border-0 shadow-md overflow-hidden" style={{ backgroundColor: brand.primary }}>
                <CardContent className="py-5">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                      <Users size={24} className="text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Talent & HR Solutions</h3>
                      <p className="text-white/70 text-sm">AI-powered recruitment and talent assessment</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all">
                  <CardContent className="p-5">
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${brand.primary}15` }}>
                      <ClipboardList size={24} style={{ color: brand.primary }} />
                    </div>
                    <h4 className="font-semibold mb-1" style={{ color: brand.primary }}>Talent Assessment</h4>
                    <p className="text-xs text-gray-500 mb-3">Comprehensive psychometric and skill assessment for hiring</p>
                    <ul className="space-y-1 mb-4">
                      {['Cognitive ability tests', 'Behavioral profiling', 'Skill-based assessments'].map((f, i) => (
                        <li key={i} className="text-[10px] text-gray-600 flex items-center gap-1">
                          <CheckCircle size={10} style={{ color: brand.accent }} /> {f}
                        </li>
                      ))}
                    </ul>
                    <Button size="sm" className="w-full text-xs text-white" style={{ backgroundColor: brand.primary }}>
                      Explore
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all">
                  <CardContent className="p-5">
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${brand.accent}20` }}>
                      <GraduationCap size={24} style={{ color: brand.accent }} />
                    </div>
                    <h4 className="font-semibold mb-1" style={{ color: brand.primary }}>Campus Recruitment</h4>
                    <p className="text-xs text-gray-500 mb-3">End-to-end campus hiring solution with AI screening</p>
                    <ul className="space-y-1 mb-4">
                      {['Bulk candidate screening', 'Video interviews', 'Offer management'].map((f, i) => (
                        <li key={i} className="text-[10px] text-gray-600 flex items-center gap-1">
                          <CheckCircle size={10} style={{ color: brand.accent }} /> {f}
                        </li>
                      ))}
                    </ul>
                    <Button size="sm" className="w-full text-xs text-white" style={{ backgroundColor: brand.accent }}>
                      Get Started
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-2 border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all" style={{ borderColor: `${brand.accent}60` }}>
                  <CardContent className="p-5">
                    <Badge className="mb-2 text-[9px] text-white" style={{ backgroundColor: brand.accent }}>AI Powered</Badge>
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${brand.accent}20` }}>
                      <Sparkles size={24} style={{ color: brand.accent }} />
                    </div>
                    <h4 className="font-semibold mb-1" style={{ color: brand.primary }}>AI Recruitment</h4>
                    <p className="text-xs text-gray-500 mb-3">Intelligent hiring agents powered by AI</p>
                    <ul className="space-y-1 mb-4">
                      {['AI resume screening', 'Automated shortlisting', 'Predictive hiring'].map((f, i) => (
                        <li key={i} className="text-[10px] text-gray-600 flex items-center gap-1">
                          <CheckCircle size={10} style={{ color: brand.accent }} /> {f}
                        </li>
                      ))}
                    </ul>
                    <Button size="sm" className="w-full text-xs text-white" style={{ backgroundColor: brand.accent }}>
                      Try AI Hiring
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* LBI Product Page */}
          {activeSection === 'lbi-product' && (
            <LBIProductPage role="institute" />
          )}

          {/* ExamReadiness Index Page */}
          {activeSection === 'exam-ready' && (
            <ExamReadinessPage role="institute" />
          )}

          {/* School Health Dashboard */}
          {activeSection === 'school-health' && (
            <SchoolHealthDashboard />
          )}

          {/* AI Powered Reports Section */}
          {activeSection === 'ai-powered-reports' && (
            <AIPoweredReports role="institute" />
          )}

          {/* MetryxAI Assistant Page */}
          {activeSection === 'metryxai-assistant' && (
            <MetryxAIAssistantPage role="institute" />
          )}

          {activeSection === 'pricing' && (
            <SubscriptionPricingPage role="institute" onNavigate={(screen) => onNavigate(screen as any)} />
          )}

          {/* AI Reports Section */}
          {activeSection === 'ai-reports' && (
            <div className="space-y-4" data-testid="ai-reports-section">
              <Card className="border-0 shadow-md overflow-hidden" style={{ backgroundColor: brand.primary }}>
                <CardContent className="py-5">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                      <Sparkles size={24} className="text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">AI-Powered Reports</h3>
                      <p className="text-white/70 text-sm">Advanced insights powered by MetryAI</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border border-gray-100 rounded-2xl shadow-sm">
                  <CardContent className="p-6 text-center">
                    <div className="h-16 w-16 rounded-xl mx-auto flex items-center justify-center mb-4" style={{ backgroundColor: `${brand.accent}20` }}>
                      <Sparkles size={32} style={{ color: brand.accent }} />
                    </div>
                    <h4 className="font-semibold text-lg mb-2" style={{ color: brand.primary }}>MetryAI Assistant</h4>
                    <p className="text-sm text-gray-500 mb-4">Chat with AI to get insights about your students' learning patterns and behavioral data</p>
                    <Button className="w-full" style={{ backgroundColor: brand.accent }} onClick={() => onNavigate('exam-ready')}>
                      <MessageCircle size={16} className="mr-2" /> Start Conversation
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border border-gray-100 rounded-2xl shadow-sm">
                  <CardContent className="p-6 text-center">
                    <div className="h-16 w-16 rounded-xl mx-auto flex items-center justify-center mb-4" style={{ backgroundColor: `${brand.primary}15` }}>
                      <PieChart size={32} style={{ color: brand.primary }} />
                    </div>
                    <h4 className="font-semibold text-lg mb-2" style={{ color: brand.primary }}>AI Insights</h4>
                    <p className="text-sm text-gray-500 mb-4">Automated analysis of student performance with predictive recommendations</p>
                    <Button variant="outline" className="w-full">
                      View Insights
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Reports Section */}
          {activeSection === 'reports' && (
            <Card className="border border-gray-100 rounded-2xl shadow-sm">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <ClipboardList size={16} style={{ color: brand.primary }} />
                    <CardTitle className="text-sm font-semibold text-gray-800">Reports & Downloads</CardTitle>
                  </div>
                  <p className="text-xs text-gray-500">Generate and download detailed reports</p>
                </div>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={handleExportData}>
                  <Download size={12} /> Export All
                </Button>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { title: 'Student Progress Report', desc: 'Individual student performance', icon: Users },
                    { title: 'Batch Summary Report', desc: 'Batch-wise analytics', icon: Layers },
                    { title: 'Exam Results Report', desc: 'Detailed exam results', icon: FileText },
                    { title: 'Enrollment Report', desc: 'Enrollment status summary', icon: UserPlus },
                    { title: 'Attendance Report', desc: 'Student attendance tracking', icon: Calendar },
                    { title: 'Custom Report', desc: 'Build your own report', icon: ClipboardList },
                  ].map((report, idx) => (
                    <div key={idx} className="p-4 border border-gray-100 rounded-2xl hover:shadow-md transition-all cursor-pointer bg-white">
                      <div 
                        className="h-10 w-10 rounded-xl flex items-center justify-center mb-3"
                        style={{ backgroundColor: `${brand.primary}15`, color: brand.primary }}
                      >
                        <report.icon size={20} />
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900">{report.title}</h3>
                      <p className="text-xs text-gray-500 mb-3">{report.desc}</p>
                      <Button variant="outline" size="sm" className="h-7 text-xs w-full">
                        <Download size={12} className="mr-1" /> Generate
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </main>
        </div>
      </div>

      {/* Create Batch Modal */}
      <Dialog open={showCreateBatchModal} onOpenChange={setShowCreateBatchModal}>
        <DialogContent className="max-w-lg font-['Inter',sans-serif]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Plus size={18} style={{ color: brand.primary }} />
              Create Batch
            </DialogTitle>
          </DialogHeader>

          {/* Mode Toggle */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={importMode === 'single' ? 'default' : 'outline'}
              size="sm"
              className="flex-1 text-xs"
              style={importMode === 'single' ? { backgroundColor: brand.primary, color: 'white' } : {}}
              onClick={() => { setImportMode('single'); setCsvData([]); }}
              data-testid="btn-mode-single"
            >
              <Plus size={14} className="mr-1" /> Single Batch
            </Button>
            <Button
              variant={importMode === 'csv' ? 'default' : 'outline'}
              size="sm"
              className="flex-1 text-xs"
              style={importMode === 'csv' ? { backgroundColor: brand.primary, color: 'white' } : {}}
              onClick={() => setImportMode('csv')}
              data-testid="btn-mode-csv"
            >
              <Upload size={14} className="mr-1" /> CSV Import
            </Button>
          </div>

          {importMode === 'single' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-600">Batch Code *</Label>
                  <Input
                    placeholder="e.g., BATCH-2025-A"
                    value={batchForm.batchCode}
                    onChange={(e) => setBatchForm({ ...batchForm, batchCode: e.target.value })}
                    className="h-9 text-xs mt-1"
                    data-testid="input-batch-code"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Academic Year *</Label>
                  <Input
                    placeholder="e.g., 2025-26"
                    value={batchForm.academicYear}
                    onChange={(e) => setBatchForm({ ...batchForm, academicYear: e.target.value })}
                    className="h-9 text-xs mt-1"
                    data-testid="input-academic-year"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-gray-600">Batch Name *</Label>
                <Input
                  placeholder="e.g., Grade 10 - Section A"
                  value={batchForm.batchName}
                  onChange={(e) => setBatchForm({ ...batchForm, batchName: e.target.value })}
                  className="h-9 text-xs mt-1"
                  data-testid="input-batch-name"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div 
                className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-gray-300 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileUpload}
                  data-testid="input-csv-file"
                />
                <FileSpreadsheet size={32} className="mx-auto mb-2 text-gray-400" />
                <p className="text-xs text-gray-600">Click to upload CSV file</p>
                <p className="text-[10px] text-gray-400 mt-1">Required columns: batchCode, batchName, academicYear</p>
              </div>

              {csvData.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-gray-700">Preview ({csvData.length} batches)</p>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] text-red-500" onClick={() => setCsvData([])}>
                      <X size={12} className="mr-1" /> Clear
                    </Button>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {csvData.slice(0, 5).map((batch, idx) => (
                      <div key={idx} className="text-[10px] text-gray-600 flex gap-3 bg-white p-1.5 rounded">
                        <span className="font-medium">{batch.batchCode}</span>
                        <span>{batch.batchName}</span>
                        <span className="text-gray-400">{batch.academicYear}</span>
                      </div>
                    ))}
                    {csvData.length > 5 && (
                      <p className="text-[10px] text-gray-400 text-center">...and {csvData.length - 5} more</p>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-[10px] text-blue-700 font-medium mb-1">CSV Format Example:</p>
                <code className="text-[9px] text-blue-600 block bg-white p-2 rounded">
                  batchCode,batchName,academicYear,status<br/>
                  BATCH-2025-A,Grade 10 Section A,2025-26,Active<br/>
                  BATCH-2025-B,Grade 10 Section B,2025-26,Active
                </code>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowCreateBatchModal(false)} data-testid="btn-cancel-batch">
              Cancel
            </Button>
            {importMode === 'single' ? (
              <Button 
                size="sm" 
                className="text-xs text-white" 
                style={{ backgroundColor: brand.primary }}
                onClick={handleCreateBatch}
                disabled={isSubmitting}
                data-testid="btn-submit-batch"
              >
                {isSubmitting ? <RefreshCw size={14} className="animate-spin mr-1" /> : <Plus size={14} className="mr-1" />}
                Create Batch
              </Button>
            ) : (
              <Button 
                size="sm" 
                className="text-xs text-white" 
                style={{ backgroundColor: brand.accent }}
                onClick={handleBulkImport}
                disabled={isSubmitting || csvData.length === 0}
                data-testid="btn-import-batches"
              >
                {isSubmitting ? <RefreshCw size={14} className="animate-spin mr-1" /> : <Upload size={14} className="mr-1" />}
                Import {csvData.length} Batches
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Exam Modal */}
      <Dialog open={showCreateExamModal} onOpenChange={setShowCreateExamModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto font-['Inter',sans-serif]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <FileText size={18} style={{ color: brand.primary }} />
              Create Exam
              {instituteRole === 'teacher' && <Badge className="bg-amber-100 text-amber-700 text-[10px] ml-2">Teacher Mode</Badge>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Exam Details Section */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: brand.primary }}>
                <BookOpen size={16} /> Exam Details
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-gray-600">Exam Code *</Label>
                  <Input
                    placeholder="e.g., EXAM-2025-001"
                    value={examForm.examCode}
                    onChange={(e) => setExamForm({ ...examForm, examCode: e.target.value })}
                    className="h-9 text-xs mt-1"
                    data-testid="input-exam-code"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-gray-600">Exam Name *</Label>
                  <Input
                    placeholder="e.g., Mid-Term Mathematics"
                    value={examForm.examName}
                    onChange={(e) => setExamForm({ ...examForm, examName: e.target.value })}
                    className="h-9 text-xs mt-1"
                    data-testid="input-exam-name"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Subject</Label>
                  <select
                    value={examForm.subject}
                    onChange={(e) => setExamForm({ ...examForm, subject: e.target.value })}
                    className="w-full h-9 text-xs mt-1 border rounded-md px-2"
                    data-testid="select-exam-subject"
                  >
                    <option value="">Select Subject</option>
                    {['Mathematics', 'Science', 'English', 'Hindi', 'Social Studies', 'Computer Science', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'Economics', 'Other'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Class/Grade</Label>
                  <select
                    value={examForm.classGrade}
                    onChange={(e) => setExamForm({ ...examForm, classGrade: e.target.value })}
                    className="w-full h-9 text-xs mt-1 border rounded-md px-2"
                    data-testid="select-exam-class"
                  >
                    <option value="">Select Class</option>
                    {Array.from({length: 12}, (_, i) => `Class ${i + 1}`).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="Custom">Custom</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Section/Batch</Label>
                  <select
                    value={examForm.batchId}
                    onChange={(e) => setExamForm({ ...examForm, batchId: e.target.value })}
                    className="w-full h-9 text-xs mt-1 border rounded-md px-2"
                    data-testid="select-exam-batch"
                  >
                    <option value="">Select Batch</option>
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>{b.batchName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Exam Type</Label>
                  <select
                    value={examForm.examType}
                    onChange={(e) => setExamForm({ ...examForm, examType: e.target.value })}
                    className="w-full h-9 text-xs mt-1 border rounded-md px-2"
                    data-testid="select-exam-type"
                  >
                    {['Unit Test', 'Mid-Term', 'Final', 'Quiz', 'Practice Test', 'Assignment', 'Board Prep'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Configuration Section */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: brand.primary }}>
                <Target size={16} /> Configuration
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs text-gray-600">Duration (mins)</Label>
                  <select
                    value={examForm.duration}
                    onChange={(e) => setExamForm({ ...examForm, duration: e.target.value })}
                    className="w-full h-9 text-xs mt-1 border rounded-md px-2"
                    data-testid="select-exam-duration"
                  >
                    {['15', '30', '45', '60', '90', '120', '180'].map(d => (
                      <option key={d} value={d}>{d} min</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Total Marks</Label>
                  <Input
                    type="number"
                    value={examForm.totalMarks}
                    onChange={(e) => setExamForm({ ...examForm, totalMarks: e.target.value })}
                    className="h-9 text-xs mt-1"
                    data-testid="input-total-marks"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Passing Marks</Label>
                  <Input
                    type="number"
                    value={examForm.passingMarks}
                    onChange={(e) => setExamForm({ ...examForm, passingMarks: e.target.value })}
                    className="h-9 text-xs mt-1"
                    data-testid="input-passing-marks"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Difficulty</Label>
                  <select
                    value={examForm.difficulty}
                    onChange={(e) => setExamForm({ ...examForm, difficulty: e.target.value })}
                    className="w-full h-9 text-xs mt-1 border rounded-md px-2"
                    data-testid="select-difficulty"
                  >
                    {['Easy', 'Medium', 'Hard', 'Mixed'].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={examForm.negativeMarking}
                      onChange={(e) => setExamForm({ ...examForm, negativeMarking: e.target.checked })}
                      className="h-4 w-4"
                      data-testid="checkbox-negative-marking"
                    />
                    Negative Marking
                  </label>
                  {examForm.negativeMarking && (
                    <Input
                      type="number"
                      step="0.25"
                      value={examForm.negativeMarkValue}
                      onChange={(e) => setExamForm({ ...examForm, negativeMarkValue: e.target.value })}
                      className="h-7 text-xs w-20"
                      placeholder="0.25"
                      data-testid="input-negative-mark-value"
                    />
                  )}
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={examForm.shuffleQuestions}
                      onChange={(e) => setExamForm({ ...examForm, shuffleQuestions: e.target.checked })}
                      className="h-4 w-4"
                      data-testid="checkbox-shuffle-questions"
                    />
                    Shuffle Questions
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={examForm.shuffleOptions}
                      onChange={(e) => setExamForm({ ...examForm, shuffleOptions: e.target.checked })}
                      className="h-4 w-4"
                      data-testid="checkbox-shuffle-options"
                    />
                    Shuffle Options
                  </label>
                </div>
              </div>
              <div className="mt-3">
                <Label className="text-xs text-gray-600 mb-2 block">Question Formats</Label>
                <div className="flex flex-wrap gap-3">
                  {['MCQ', 'True/False', 'Fill in the Blank', 'Short Answer', 'Long Answer', 'Match the Following'].map(fmt => (
                    <label key={fmt} className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={examForm.questionFormats.includes(fmt)}
                        onChange={(e) => {
                          const formats = e.target.checked
                            ? [...examForm.questionFormats, fmt]
                            : examForm.questionFormats.filter(f => f !== fmt);
                          setExamForm({ ...examForm, questionFormats: formats });
                        }}
                        className="h-3.5 w-3.5"
                        data-testid={`checkbox-format-${fmt.replace(/\s+/g, '-').toLowerCase()}`}
                      />
                      {fmt}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Schedule Section */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: brand.primary }}>
                <Calendar size={16} /> Schedule
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-600">Start Date/Time</Label>
                  <Input
                    type="datetime-local"
                    value={examForm.startAt}
                    onChange={(e) => setExamForm({ ...examForm, startAt: e.target.value })}
                    className="h-9 text-xs mt-1"
                    data-testid="input-exam-start"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">End Date/Time</Label>
                  <Input
                    type="datetime-local"
                    value={examForm.endAt}
                    onChange={(e) => setExamForm({ ...examForm, endAt: e.target.value })}
                    className="h-9 text-xs mt-1"
                    data-testid="input-exam-end"
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={examForm.allowLateSubmission}
                    onChange={(e) => setExamForm({ ...examForm, allowLateSubmission: e.target.checked })}
                    className="h-4 w-4"
                    data-testid="checkbox-late-submission"
                  />
                  Allow Late Submission
                </label>
                {examForm.allowLateSubmission && (
                  <div className="flex items-center gap-1">
                    <Label className="text-xs text-gray-500">Grace Period:</Label>
                    <Input
                      type="number"
                      value={examForm.gracePeriod}
                      onChange={(e) => setExamForm({ ...examForm, gracePeriod: e.target.value })}
                      className="h-7 text-xs w-16"
                      data-testid="input-grace-period"
                    />
                    <span className="text-xs text-gray-500">min</span>
                  </div>
                )}
              </div>
            </div>

            {/* Instructions Section */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: brand.primary }}>
                <ClipboardList size={16} /> Instructions
              </h3>
              <Textarea
                value={examForm.instructions}
                onChange={(e) => setExamForm({ ...examForm, instructions: e.target.value })}
                className="text-xs min-h-[80px]"
                placeholder="Enter exam instructions..."
                data-testid="textarea-instructions"
              />
              <div className="mt-2 flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={examForm.calculatorAllowed}
                    onChange={(e) => setExamForm({ ...examForm, calculatorAllowed: e.target.checked })}
                    className="h-4 w-4"
                    data-testid="checkbox-calculator"
                  />
                  Calculator Allowed
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={examForm.referenceMaterial}
                    onChange={(e) => setExamForm({ ...examForm, referenceMaterial: e.target.checked })}
                    className="h-4 w-4"
                    data-testid="checkbox-reference"
                  />
                  Reference Material
                </label>
              </div>
            </div>

            {/* AI Question Generator Section */}
            <div className="border border-gray-100 rounded-xl p-4" style={{ borderColor: `${brand.accent}40` }}>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: brand.accent }}>
                <Brain size={16} /> AI Question Generator
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-gray-600">Topic/Chapter</Label>
                  <Input
                    value={aiGenTopic}
                    onChange={(e) => setAiGenTopic(e.target.value)}
                    placeholder="e.g., Quadratic Equations"
                    className="h-9 text-xs mt-1"
                    data-testid="input-ai-topic"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">No. of Questions</Label>
                  <Input
                    type="number"
                    value={aiGenCount}
                    onChange={(e) => setAiGenCount(e.target.value)}
                    min="1"
                    max="20"
                    className="h-9 text-xs mt-1"
                    data-testid="input-ai-count"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Difficulty</Label>
                  <select
                    value={aiGenDifficulty}
                    onChange={(e) => setAiGenDifficulty(e.target.value)}
                    className="w-full h-9 text-xs mt-1 border rounded-md px-2"
                    data-testid="select-ai-difficulty"
                  >
                    {['Easy', 'Medium', 'Hard', 'Mixed'].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
              <Button
                size="sm"
                className="mt-3 text-xs text-white gap-1"
                style={{ backgroundColor: brand.accent }}
                onClick={handleAIGenerate}
                disabled={aiGenerating || !aiGenTopic}
                data-testid="btn-ai-generate"
              >
                {aiGenerating ? <RefreshCw size={14} className="animate-spin" /> : <Wand2 size={14} />}
                {aiGenerating ? 'Generating...' : 'Generate with AI'}
              </Button>
              {aiGeneratedQuestions.length > 0 && (
                <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
                  <p className="text-xs font-medium text-gray-700">{aiGeneratedQuestions.length} questions generated:</p>
                  {aiGeneratedQuestions.map((q, idx) => (
                    <div key={idx} className="text-[10px] p-2 bg-gray-50 rounded">
                      <p className="font-medium text-gray-800">Q{idx + 1}. {q.question}</p>
                      <div className="grid grid-cols-2 gap-1 mt-1 text-gray-500">
                        <span className={q.answer === 'A' ? 'text-teal-600 font-medium' : ''}>A: {q.optionA}</span>
                        <span className={q.answer === 'B' ? 'text-teal-600 font-medium' : ''}>B: {q.optionB}</span>
                        <span className={q.answer === 'C' ? 'text-teal-600 font-medium' : ''}>C: {q.optionC}</span>
                        <span className={q.answer === 'D' ? 'text-teal-600 font-medium' : ''}>D: {q.optionD}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Maker-Checker Section */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: brand.primary }}>
                <Shield size={16} /> Submission & Approval
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-600">Created By</Label>
                  <Input
                    value={examForm.createdBy}
                    onChange={(e) => setExamForm({ ...examForm, createdBy: e.target.value })}
                    className="h-9 text-xs mt-1 bg-gray-50"
                    data-testid="input-created-by"
                    readOnly
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Status</Label>
                  <select
                    value={examForm.status}
                    onChange={(e) => setExamForm({ ...examForm, status: e.target.value })}
                    className="w-full h-9 text-xs mt-1 border rounded-md px-2"
                    data-testid="select-exam-status"
                  >
                    <option value="Draft">Draft</option>
                    {instituteRole === 'teacher' && <option value="Submit for Approval">Submit for Approval</option>}
                    {instituteRole === 'admin' && <option value="Active">Published</option>}
                  </select>
                </div>
              </div>
              {(examForm.status === 'Submit for Approval') && (
                <div className="mt-3">
                  <Label className="text-xs text-gray-600">Approval Note</Label>
                  <Textarea
                    value={examForm.approvalNote}
                    onChange={(e) => setExamForm({ ...examForm, approvalNote: e.target.value })}
                    className="text-xs mt-1 min-h-[60px]"
                    placeholder="Add a note for the admin reviewer..."
                    data-testid="textarea-approval-note"
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowCreateExamModal(false)} data-testid="btn-cancel-exam">
              Cancel
            </Button>
            <Button 
              size="sm" 
              className="text-xs text-white" 
              style={{ backgroundColor: brand.primary }}
              onClick={handleCreateExam}
              disabled={isSubmitting}
              data-testid="btn-submit-exam"
            >
              {isSubmitting ? <RefreshCw size={14} className="animate-spin mr-1" /> : <Plus size={14} className="mr-1" />}
              {examForm.status === 'Submit for Approval' ? 'Submit for Approval' : 'Create Exam'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Exam Modal */}
      <Dialog open={showImportExamModal} onOpenChange={setShowImportExamModal}>
        <DialogContent className="max-w-lg font-['Inter',sans-serif]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Upload size={18} style={{ color: brand.primary }} />
              Import Exams
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div 
              className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-gray-300"
              onClick={() => examFileInputRef.current?.click()}
              data-testid="exam-csv-dropzone"
            >
              <input
                ref={examFileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleExamFileUpload}
                data-testid="input-exam-csv-file"
              />
              <FileSpreadsheet size={32} className="mx-auto mb-2 text-gray-400" />
              <p className="text-xs text-gray-600">Click to upload CSV file</p>
              <p className="text-[10px] text-gray-400 mt-1">Required columns: examCode, examName</p>
            </div>

            {examCsvData.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-700">Preview ({examCsvData.length} exams)</p>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] text-red-500" onClick={() => setExamCsvData([])} data-testid="btn-clear-exam-csv">
                    <X size={12} className="mr-1" /> Clear
                  </Button>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {examCsvData.slice(0, 5).map((exam, idx) => (
                    <div key={idx} className="text-[10px] text-gray-600 flex gap-3 bg-white p-1.5 rounded">
                      <span className="font-medium">{exam.examCode}</span>
                      <span>{exam.examName}</span>
                      {exam.subject && <span className="text-gray-400">{exam.subject}</span>}
                    </div>
                  ))}
                  {examCsvData.length > 5 && (
                    <p className="text-[10px] text-gray-400 text-center">...and {examCsvData.length - 5} more</p>
                  )}
                </div>
              </div>
            )}

            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-[10px] text-blue-700 font-medium mb-1">CSV Format Example:</p>
              <code className="text-[9px] text-blue-600 block bg-white p-2 rounded">
                examCode,examName,subject,class,duration,totalMarks<br/>
                MATH-UT-001,Math Unit Test 1,Mathematics,Class 10,60,100<br/>
                SCI-MID-001,Science Mid-Term,Science,Class 8,90,80
              </code>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowImportExamModal(false)} data-testid="btn-cancel-import-exam">
              Cancel
            </Button>
            <Button 
              size="sm" 
              className="text-xs text-white" 
              style={{ backgroundColor: brand.accent }}
              onClick={handleBulkExamImport}
              disabled={isSubmitting || examCsvData.length === 0}
              data-testid="btn-import-exams-submit"
            >
              {isSubmitting ? <RefreshCw size={14} className="animate-spin mr-1" /> : <Upload size={14} className="mr-1" />}
              Import {examCsvData.length} Exams
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Student Modal */}
      <Dialog open={showAddStudentModal} onOpenChange={setShowAddStudentModal}>
        <DialogContent className="max-w-lg font-['Inter',sans-serif]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <UserPlus size={18} style={{ color: brand.primary }} />
              Add Student
            </DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 mb-4">
            <Button
              variant={studentImportMode === 'single' ? 'default' : 'outline'}
              size="sm"
              className="flex-1 text-xs"
              style={studentImportMode === 'single' ? { backgroundColor: brand.primary, color: 'white' } : {}}
              onClick={() => { setStudentImportMode('single'); setStudentCsvData([]); }}
            >
              <Plus size={14} className="mr-1" /> Single Student
            </Button>
            <Button
              variant={studentImportMode === 'csv' ? 'default' : 'outline'}
              size="sm"
              className="flex-1 text-xs"
              style={studentImportMode === 'csv' ? { backgroundColor: brand.primary, color: 'white' } : {}}
              onClick={() => setStudentImportMode('csv')}
            >
              <Upload size={14} className="mr-1" /> CSV Import
            </Button>
          </div>
          {studentImportMode === 'single' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-600">Student Code *</Label>
                  <Input
                    placeholder="e.g., STU-2025-001"
                    value={studentForm.studentCode}
                    onChange={(e) => setStudentForm({ ...studentForm, studentCode: e.target.value })}
                    className="h-9 text-xs mt-1"
                    data-testid="input-student-code"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Date of Birth</Label>
                  <Input
                    type="date"
                    value={studentForm.dob}
                    onChange={(e) => setStudentForm({ ...studentForm, dob: e.target.value })}
                    className="h-9 text-xs mt-1"
                    data-testid="input-student-dob"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-gray-600">Full Name *</Label>
                <Input
                  placeholder="e.g., John Doe"
                  value={studentForm.fullName}
                  onChange={(e) => setStudentForm({ ...studentForm, fullName: e.target.value })}
                  className="h-9 text-xs mt-1"
                  data-testid="input-student-name"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div 
                className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-gray-300"
                onClick={() => studentFileInputRef.current?.click()}
              >
                <input
                  ref={studentFileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleStudentFileUpload}
                />
                <FileSpreadsheet size={32} className="mx-auto mb-2 text-gray-400" />
                <p className="text-xs text-gray-600">Click to upload CSV file</p>
                <p className="text-[10px] text-gray-400 mt-1">Required columns: studentCode, fullName</p>
              </div>
              {studentCsvData.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-gray-700">Preview ({studentCsvData.length} students)</p>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] text-red-500" onClick={() => setStudentCsvData([])}>
                      <X size={12} className="mr-1" /> Clear
                    </Button>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {studentCsvData.slice(0, 5).map((s, idx) => (
                      <div key={idx} className="text-[10px] text-gray-600 flex gap-3 bg-white p-1.5 rounded">
                        <span className="font-medium">{s.studentCode}</span>
                        <span>{s.fullName}</span>
                      </div>
                    ))}
                    {studentCsvData.length > 5 && (
                      <p className="text-[10px] text-gray-400 text-center">...and {studentCsvData.length - 5} more</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowAddStudentModal(false)}>
              Cancel
            </Button>
            {studentImportMode === 'single' ? (
              <Button 
                size="sm" 
                className="text-xs text-white" 
                style={{ backgroundColor: brand.primary }}
                onClick={handleAddStudent}
                disabled={isSubmitting}
                data-testid="btn-submit-student"
              >
                {isSubmitting ? <RefreshCw size={14} className="animate-spin mr-1" /> : <Plus size={14} className="mr-1" />}
                Add Student
              </Button>
            ) : (
              <Button 
                size="sm" 
                className="text-xs text-white" 
                style={{ backgroundColor: brand.accent }}
                onClick={handleBulkStudentImport}
                disabled={isSubmitting || studentCsvData.length === 0}
              >
                {isSubmitting ? <RefreshCw size={14} className="animate-spin mr-1" /> : <Upload size={14} className="mr-1" />}
                Import {studentCsvData.length} Students
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile Modal */}
      <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
        <DialogContent className="max-w-md font-['Inter',sans-serif]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Building2 size={18} style={{ color: brand.primary }} />
              Institute Profile
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-gray-600">Display Name</Label>
              <Input
                value={profileForm.displayName}
                onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })}
                className="h-9 text-xs mt-1"
                data-testid="input-profile-display-name"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Legal Name</Label>
              <Input
                value={profileForm.legalName}
                onChange={(e) => setProfileForm({ ...profileForm, legalName: e.target.value })}
                className="h-9 text-xs mt-1"
                data-testid="input-profile-legal-name"
              />
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500">
              <p><strong>Institute Code:</strong> {institute?.instituteCode}</p>
              <p><strong>Status:</strong> {institute?.status}</p>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowProfileModal(false)}>
              Cancel
            </Button>
            <Button 
              size="sm" 
              className="text-xs text-white" 
              style={{ backgroundColor: brand.primary }}
              onClick={handleUpdateProfile}
              disabled={isSubmitting}
              data-testid="btn-save-profile"
            >
              {isSubmitting ? <RefreshCw size={14} className="animate-spin mr-1" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Modal */}
      <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
        <DialogContent className="max-w-md font-['Inter',sans-serif]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              Settings
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 border border-gray-100 rounded-xl">
              <h4 className="text-xs font-semibold mb-2">Notifications</h4>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Email Notifications</span>
                <input type="checkbox" defaultChecked className="h-4 w-4" />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-600">Enrollment Alerts</span>
                <input type="checkbox" defaultChecked className="h-4 w-4" />
              </div>
            </div>
            <div className="p-4 border border-gray-100 rounded-xl">
              <h4 className="text-xs font-semibold mb-2">Preferences</h4>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Auto-approve Enrollments</span>
                <input type="checkbox" className="h-4 w-4" />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-600">Show Analytics</span>
                <input type="checkbox" defaultChecked className="h-4 w-4" />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowSettingsModal(false)}>
              Close
            </Button>
            <Button 
              size="sm" 
              className="text-xs text-white" 
              style={{ backgroundColor: brand.primary }}
              onClick={() => { toast({ title: "Settings Saved" }); setShowSettingsModal(false); }}
              data-testid="btn-save-settings"
            >
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Question Builder Modal */}
      <Dialog open={showQuestionBuilderModal} onOpenChange={(open) => { setShowQuestionBuilderModal(open); if (!open) setExamQuestions([]); }}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold" style={{ color: brand.primary }}>
              Manage Questions - {selectedExamForQuestions?.examName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Existing Questions */}
            <div>
              <h4 className="text-sm font-medium mb-2">Questions ({examQuestions.length})</h4>
              {examQuestions.length === 0 ? (
                <p className="text-xs text-gray-500 py-4 text-center">No questions added yet</p>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {examQuestions.map((q, idx) => (
                    <div key={q.id} className="p-3 bg-gray-50 rounded-xl flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-xs font-medium">Q{idx + 1}. {q.questionText}</p>
                        <div className="text-[10px] text-gray-500 mt-1 grid grid-cols-2 gap-1">
                          <span className={q.correctOption === 'A' ? 'text-teal-600 font-medium' : ''}>A: {q.optionA}</span>
                          <span className={q.correctOption === 'B' ? 'text-teal-600 font-medium' : ''}>B: {q.optionB}</span>
                          {q.optionC && <span className={q.correctOption === 'C' ? 'text-teal-600 font-medium' : ''}>C: {q.optionC}</span>}
                          {q.optionD && <span className={q.correctOption === 'D' ? 'text-teal-600 font-medium' : ''}>D: {q.optionD}</span>}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">Marks: {q.marks}</p>
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 text-red-500 hover:text-red-700" onClick={() => handleDeleteQuestion(q.id)} data-testid={`btn-delete-question-${q.id}`}>
                        <X size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add New Question Form */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-2">Add New Question</h4>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Question Text *</Label>
                  <Input 
                    className="text-xs h-9 mt-1"
                    placeholder="Enter your question..."
                    value={newQuestion.questionText}
                    onChange={(e) => setNewQuestion({...newQuestion, questionText: e.target.value})}
                    data-testid="input-question-text"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Option A *</Label>
                    <Input 
                      className="text-xs h-9 mt-1"
                      placeholder="Option A"
                      value={newQuestion.optionA}
                      onChange={(e) => setNewQuestion({...newQuestion, optionA: e.target.value})}
                      data-testid="input-option-a"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Option B *</Label>
                    <Input 
                      className="text-xs h-9 mt-1"
                      placeholder="Option B"
                      value={newQuestion.optionB}
                      onChange={(e) => setNewQuestion({...newQuestion, optionB: e.target.value})}
                      data-testid="input-option-b"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Option C</Label>
                    <Input 
                      className="text-xs h-9 mt-1"
                      placeholder="Option C (optional)"
                      value={newQuestion.optionC}
                      onChange={(e) => setNewQuestion({...newQuestion, optionC: e.target.value})}
                      data-testid="input-option-c"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Option D</Label>
                    <Input 
                      className="text-xs h-9 mt-1"
                      placeholder="Option D (optional)"
                      value={newQuestion.optionD}
                      onChange={(e) => setNewQuestion({...newQuestion, optionD: e.target.value})}
                      data-testid="input-option-d"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Correct Answer *</Label>
                    <select 
                      className="w-full h-9 text-xs mt-1 rounded-md border border-gray-200 px-2"
                      value={newQuestion.correctOption}
                      onChange={(e) => setNewQuestion({...newQuestion, correctOption: e.target.value})}
                      data-testid="select-correct-option"
                    >
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Marks</Label>
                    <Input 
                      type="number"
                      className="text-xs h-9 mt-1"
                      min={1}
                      value={newQuestion.marks}
                      onChange={(e) => setNewQuestion({...newQuestion, marks: parseInt(e.target.value) || 1})}
                      data-testid="input-marks"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowQuestionBuilderModal(false)}>
              Close
            </Button>
            <Button 
              size="sm" 
              className="text-xs text-white"
              style={{ backgroundColor: brand.primary }}
              disabled={isSubmitting || !newQuestion.questionText || !newQuestion.optionA || !newQuestion.optionB}
              onClick={handleAddQuestion}
              data-testid="btn-add-question"
            >
              {isSubmitting ? <RefreshCw size={14} className="mr-1 animate-spin" /> : <Plus size={14} className="mr-1" />}
              Add Question
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Tour Overlay */}
      {showTour && (
        <QuickTour
          type="institute"
          onClose={() => setShowTour(false)}
          onNavigate={(section) => setActiveSection(section)}
        />
      )}

      {/* Global Search */}
      {showSearch && (
        <GlobalSearch
          role="institute"
          onNavigate={(screen) => onNavigate(screen as any)}
          onMenuSelect={(item) => setActiveSection(item)}
          onClose={() => setShowSearch(false)}
          onShowTour={() => setShowTour(true)}
        />
      )}

      {/* Help Center Dialog */}
      <HelpCenter 
        isOpen={showHelpCenter} 
        onClose={() => setShowHelpCenter(false)} 
        portalType="institute"
      />

      {/* Floating Help Button */}
      <FloatingHelpButton 
        onClick={() => setShowHelpCenter(true)}
        label="Need Help?"
      />

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-2 z-20">
        <div className="flex justify-around">
          <button
            onClick={() => setActiveSection('overview')}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors ${
              activeSection === 'overview' ? '' : 'text-gray-500'
            }`}
            style={activeSection === 'overview' ? { color: brand.primary } : {}}
            data-testid="mobile-nav-overview"
          >
            <Home size={20} />
            <span className="text-[10px] font-medium">Home</span>
          </button>
          <button
            onClick={() => setActiveSection('students')}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors ${
              activeSection === 'students' ? '' : 'text-gray-500'
            }`}
            style={activeSection === 'students' ? { color: brand.primary } : {}}
            data-testid="mobile-nav-students"
          >
            <Users size={20} />
            <span className="text-[10px] font-medium">Students</span>
          </button>
          <button
            onClick={() => setActiveSection('exams')}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors ${
              activeSection === 'exams' ? '' : 'text-gray-500'
            }`}
            style={activeSection === 'exams' ? { color: brand.primary } : {}}
            data-testid="mobile-nav-exams"
          >
            <FileText size={20} />
            <span className="text-[10px] font-medium">Exams</span>
          </button>
          <button
            onClick={() => setActiveSection('analytics')}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl relative transition-colors ${
              activeSection === 'analytics' ? '' : 'text-gray-500'
            }`}
            style={activeSection === 'analytics' ? { color: brand.primary } : {}}
            data-testid="mobile-nav-analytics"
          >
            <PieChart size={20} />
            <span className="text-[10px] font-medium">Analytics</span>
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full" style={{ backgroundColor: brand.accent }} />
          </button>
        </div>
      </nav>

    </div>
  );
}

// Helper Components
function KPICard({ title, value, icon: Icon, trend, trendLabel, color, alert }: {
  title: string;
  value: number | string;
  icon: any;
  trend?: number;
  trendLabel?: string;
  color: string;
  alert?: boolean;
}) {
  return (
    <div className={`bg-white border border-gray-100 rounded-2xl p-4 shadow-sm ${alert ? 'ring-2 ring-amber-200' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div 
          className="h-10 w-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${color}15`, color }}
        >
          <Icon size={20} />
        </div>
        <div className="flex flex-col items-end gap-1">
          {trend !== undefined && trend !== 0 && (
            <div className={`flex items-center gap-0.5 text-[10px] font-medium ${trend > 0 ? 'text-teal-600' : 'text-red-500'}`}>
              {trend > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {Math.abs(trend)}%
            </div>
          )}
          {alert && <AlertCircle size={16} className="text-amber-500" />}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{title}</p>
      {trendLabel && <p className="text-[10px] text-gray-400 mt-0.5">{trendLabel}</p>}
    </div>
  );
}

function ExamStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Active: 'bg-teal-100 text-teal-700',
    Draft: 'bg-gray-100 text-gray-600',
    Completed: 'bg-blue-100 text-blue-700',
    Cancelled: 'bg-red-100 text-red-700',
  };
  return (
    <Badge className={`text-[10px] font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </Badge>
  );
}

function BatchStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Active: 'bg-teal-100 text-teal-700',
    Inactive: 'bg-gray-100 text-gray-600',
    Archived: 'bg-amber-100 text-amber-700',
  };
  return (
    <Badge className={`text-[10px] font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </Badge>
  );
}

function EnrollmentStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Pending: 'bg-amber-100 text-amber-700',
    Approved: 'bg-teal-100 text-teal-700',
    Rejected: 'bg-red-100 text-red-700',
  };
  return (
    <Badge className={`text-[10px] font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </Badge>
  );
}

const BOARDS_DATA = [
  { id: 'cbse', name: 'CBSE' },
  { id: 'icse', name: 'ICSE' },
  { id: 'state-mh', name: 'Maharashtra State Board' },
  { id: 'state-ka', name: 'Karnataka State Board' },
  { id: 'state-tn', name: 'Tamil Nadu State Board' },
  { id: 'ib', name: 'IB (International)' },
  { id: 'cambridge', name: 'Cambridge (IGCSE)' },
];

const CLASSES_DATA = Array.from({ length: 12 }, (_, i) => ({ id: `class-${i + 1}`, name: `Class ${i + 1}`, number: i + 1 }));

const SUBJECTS_DATA: Record<string, string[]> = {
  'cbse': ['Mathematics', 'Science', 'English', 'Hindi', 'Social Science', 'Computer Science', 'Sanskrit', 'Physical Education'],
  'icse': ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Hindi', 'History & Civics', 'Geography', 'Computer Applications'],
  'default': ['Mathematics', 'Science', 'English', 'Social Studies', 'Language II', 'Computer Science'],
};

const BATCHES_DATA = ['Batch A (Morning)', 'Batch B (Afternoon)', 'Batch C (Evening)', 'Online Batch 1', 'Online Batch 2'];

interface SyllabusPlan {
  id: string;
  board: string;
  classLevel: string;
  subject: string;
  batch: string;
  type: 'template' | 'imported' | 'custom';
  status: 'active' | 'draft' | 'archived';
  chapters: number;
  completedChapters: number;
  startDate: string;
  endDate: string;
  createdBy: string;
  lastUpdated: string;
}

const SAMPLE_PLANS: SyllabusPlan[] = [
  { id: 'SP001', board: 'CBSE', classLevel: 'Class 10', subject: 'Mathematics', batch: 'Batch A (Morning)', type: 'template', status: 'active', chapters: 15, completedChapters: 8, startDate: '2026-01-06', endDate: '2026-03-15', createdBy: 'System', lastUpdated: '2026-02-05' },
  { id: 'SP002', board: 'CBSE', classLevel: 'Class 10', subject: 'Science', batch: 'Batch A (Morning)', type: 'template', status: 'active', chapters: 16, completedChapters: 9, startDate: '2026-01-06', endDate: '2026-03-15', createdBy: 'System', lastUpdated: '2026-02-04' },
  { id: 'SP003', board: 'CBSE', classLevel: 'Class 8', subject: 'English', batch: 'Batch B (Afternoon)', type: 'custom', status: 'active', chapters: 12, completedChapters: 6, startDate: '2026-01-10', endDate: '2026-03-20', createdBy: 'Mrs. Sharma', lastUpdated: '2026-02-03' },
  { id: 'SP004', board: 'ICSE', classLevel: 'Class 9', subject: 'Physics', batch: 'Batch A (Morning)', type: 'imported', status: 'active', chapters: 14, completedChapters: 5, startDate: '2026-01-08', endDate: '2026-03-25', createdBy: 'Mr. Patel', lastUpdated: '2026-02-06' },
  { id: 'SP005', board: 'CBSE', classLevel: 'Class 12', subject: 'Mathematics', batch: 'Online Batch 1', type: 'template', status: 'draft', chapters: 13, completedChapters: 0, startDate: '2026-02-10', endDate: '2026-04-15', createdBy: 'System', lastUpdated: '2026-02-01' },
  { id: 'SP006', board: 'CBSE', classLevel: 'Class 7', subject: 'Hindi', batch: 'Batch C (Evening)', type: 'custom', status: 'active', chapters: 10, completedChapters: 7, startDate: '2026-01-05', endDate: '2026-02-28', createdBy: 'Mrs. Gupta', lastUpdated: '2026-02-07' },
  { id: 'SP007', board: 'ICSE', classLevel: 'Class 10', subject: 'Chemistry', batch: 'Batch A (Morning)', type: 'imported', status: 'archived', chapters: 16, completedChapters: 16, startDate: '2025-08-01', endDate: '2025-12-15', createdBy: 'Mr. Rao', lastUpdated: '2025-12-15' },
  { id: 'SP008', board: 'CBSE', classLevel: 'Class 6', subject: 'Social Science', batch: 'Batch B (Afternoon)', type: 'template', status: 'active', chapters: 11, completedChapters: 4, startDate: '2026-01-12', endDate: '2026-03-30', createdBy: 'System', lastUpdated: '2026-02-02' },
];

function EducationPlanner() {
  const [activeTab, setActiveTab] = useState<'study-plans' | 'syllabus' | 'templates'>('study-plans');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBoard, setFilterBoard] = useState('all');
  const [filterClass, setFilterClass] = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterBatch, setFilterBatch] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SyllabusPlan | null>(null);
  const [createForm, setCreateForm] = useState({ board: '', classLevel: '', subject: '', batch: '', type: 'custom' as const, startDate: '', endDate: '' });
  const { toast } = useToast();

  const filteredPlans = SAMPLE_PLANS.filter(p => {
    if (searchQuery && !p.subject.toLowerCase().includes(searchQuery.toLowerCase()) && !p.classLevel.toLowerCase().includes(searchQuery.toLowerCase()) && !p.id.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterBoard !== 'all' && p.board !== filterBoard) return false;
    if (filterClass !== 'all' && p.classLevel !== filterClass) return false;
    if (filterSubject !== 'all' && p.subject !== filterSubject) return false;
    if (filterBatch !== 'all' && p.batch !== filterBatch) return false;
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    return true;
  });

  const handleExport = () => {
    const headers = ['ID', 'Board', 'Class', 'Subject', 'Batch', 'Type', 'Status', 'Chapters', 'Completed', 'Progress%', 'Start', 'End', 'Created By', 'Updated'];
    const rows = filteredPlans.map(p => [p.id, p.board, p.classLevel, p.subject, p.batch, p.type, p.status, p.chapters, p.completedChapters, Math.round((p.completedChapters / p.chapters) * 100), p.startDate, p.endDate, p.createdBy, p.lastUpdated]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `study_plans_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: `${filteredPlans.length} plans exported as CSV` });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      toast({ title: 'Invalid File', description: 'Please upload a CSV file', variant: 'destructive' });
      return;
    }
    toast({ title: 'Import Started', description: `Processing ${file.name}...` });
    setTimeout(() => {
      toast({ title: 'Import Complete', description: '3 study plans imported successfully' });
      setShowImportModal(false);
    }, 1500);
  };

  const handleCreate = () => {
    if (!createForm.board || !createForm.classLevel || !createForm.subject || !createForm.batch) {
      toast({ title: 'Missing Fields', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    toast({ title: 'Plan Created', description: `Study plan for ${createForm.subject} - ${createForm.classLevel} created successfully` });
    setShowCreateModal(false);
    setCreateForm({ board: '', classLevel: '', subject: '', batch: '', type: 'custom', startDate: '', endDate: '' });
  };

  const subjects = SUBJECTS_DATA[filterBoard] || SUBJECTS_DATA['default'];

  const stats = {
    total: SAMPLE_PLANS.length,
    active: SAMPLE_PLANS.filter(p => p.status === 'active').length,
    avgProgress: Math.round(SAMPLE_PLANS.reduce((acc, p) => acc + (p.completedChapters / p.chapters) * 100, 0) / SAMPLE_PLANS.length),
    boards: [...new Set(SAMPLE_PLANS.map(p => p.board))].length,
  };

  return (
    <div className="space-y-4" data-testid="education-section">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{ color: brand.primary }} data-testid="text-education-title">Education</h2>
          <p className="text-xs text-muted-foreground">Welcome back, Institute</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 text-xs w-48"
              data-testid="input-education-search"
            />
          </div>
          <select
            value={filterBoard}
            onChange={(e) => setFilterBoard(e.target.value)}
            className="h-8 text-xs border rounded-md px-2"
            data-testid="select-filter-board"
          >
            <option value="all">All Boards</option>
            {BOARDS_DATA.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
          </select>
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="h-8 text-xs border rounded-md px-2"
            data-testid="select-filter-class"
          >
            <option value="all">All Classes</option>
            {CLASSES_DATA.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={handleExport} data-testid="btn-export-plans">
            <Download size={12} /> Export
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => toast({ title: 'Refreshed', description: 'Data updated' })} data-testid="btn-refresh-plans">
            <RefreshCw size={12} /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Plans', value: stats.total, icon: BookOpen, color: brand.primary },
          { label: 'Active Plans', value: stats.active, icon: CheckCircle, color: '#4ECDC4' },
          { label: 'Avg Progress', value: `${stats.avgProgress}%`, icon: TrendingUp, color: brand.accent },
          { label: 'Boards Covered', value: stats.boards, icon: Layers, color: '#0B3C5D' },
        ].map((stat, idx) => (
          <Card key={idx} className="border border-gray-100 rounded-2xl shadow-sm" data-testid={`edu-stat-${idx}`}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${stat.color}12` }}>
                  <stat.icon size={16} style={{ color: stat.color }} />
                </div>
              </div>
              <p className="text-xl font-bold" style={{ color: brand.primary }}>{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-2 border-b pb-2">
        {[
          { id: 'study-plans' as const, label: 'Study Plans', icon: BookOpen },
          { id: 'syllabus' as const, label: 'Syllabus Planner', icon: ClipboardList },
          { id: 'templates' as const, label: 'Templates', icon: Layers },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${activeTab === tab.id ? 'text-white' : ''}`}
            style={activeTab === tab.id ? { backgroundColor: brand.primary } : { color: brand.primary }}
            data-testid={`tab-edu-${tab.id}`}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" className="h-8 text-xs gap-1 text-white" style={{ backgroundColor: brand.accent }} onClick={() => setShowCreateModal(true)} data-testid="btn-create-plan">
            <Plus size={12} /> Create Plan
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setShowImportModal(true)} data-testid="btn-import-plan">
            <Upload size={12} /> Import CSV
          </Button>
        </div>
      </div>

      {activeTab === 'study-plans' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <select value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)} className="h-7 text-[10px] border rounded-md px-2" data-testid="select-filter-batch">
              <option value="all">All Batches</option>
              {BATCHES_DATA.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} className="h-7 text-[10px] border rounded-md px-2" data-testid="select-filter-subject">
              <option value="all">All Subjects</option>
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-7 text-[10px] border rounded-md px-2" data-testid="select-filter-status">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
            <span className="text-[10px] text-muted-foreground ml-auto">{filteredPlans.length} plans found</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs" data-testid="table-study-plans">
              <thead>
                <tr className="border-b text-left" style={{ color: brand.primary }}>
                  <th className="py-2 px-2 font-semibold">ID</th>
                  <th className="py-2 px-2 font-semibold">Board</th>
                  <th className="py-2 px-2 font-semibold">Class</th>
                  <th className="py-2 px-2 font-semibold">Subject</th>
                  <th className="py-2 px-2 font-semibold">Batch</th>
                  <th className="py-2 px-2 font-semibold">Type</th>
                  <th className="py-2 px-2 font-semibold">Progress</th>
                  <th className="py-2 px-2 font-semibold">Status</th>
                  <th className="py-2 px-2 font-semibold">Updated</th>
                  <th className="py-2 px-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlans.map(plan => {
                  const pct = Math.round((plan.completedChapters / plan.chapters) * 100);
                  return (
                    <tr key={plan.id} className="border-b hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setSelectedPlan(plan)} data-testid={`plan-row-${plan.id}`}>
                      <td className="py-2.5 px-2 font-mono font-medium" style={{ color: brand.primary }}>{plan.id}</td>
                      <td className="py-2.5 px-2">{plan.board}</td>
                      <td className="py-2.5 px-2">{plan.classLevel}</td>
                      <td className="py-2.5 px-2 font-medium">{plan.subject}</td>
                      <td className="py-2.5 px-2 text-muted-foreground">{plan.batch}</td>
                      <td className="py-2.5 px-2">
                        <Badge variant="outline" className="text-[9px]" style={plan.type === 'template' ? { borderColor: brand.primary, color: brand.primary } : plan.type === 'imported' ? { borderColor: brand.accent, color: brand.accent } : {}}>
                          {plan.type}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-gray-100">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: pct >= 70 ? '#4ECDC4' : pct >= 40 ? brand.accent : '#f59e0b' }} />
                          </div>
                          <span className="text-[10px] font-medium">{pct}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        <Badge className={`text-[9px] ${plan.status === 'active' ? 'bg-teal-100 text-teal-700' : plan.status === 'draft' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                          {plan.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-2 text-muted-foreground">{plan.lastUpdated}</td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); setSelectedPlan(plan); }} data-testid={`btn-view-${plan.id}`}>
                            <Eye size={12} />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" data-testid={`btn-more-${plan.id}`}>
                            <MoreVertical size={12} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'syllabus' && (
        <div className="grid md:grid-cols-2 gap-4">
          {BOARDS_DATA.slice(0, 4).map(board => (
            <Card key={board.id} className="border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all" data-testid={`syllabus-board-${board.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${brand.primary}10` }}>
                    <GraduationCap size={20} style={{ color: brand.primary }} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold" style={{ color: brand.primary }}>{board.name}</h4>
                    <p className="text-[10px] text-muted-foreground">Board-wise syllabus mapping</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {['Class 6-8', 'Class 9-10', 'Class 11-12'].map(range => (
                    <div key={range} className="p-2 rounded-xl border text-center text-[10px] font-medium hover:shadow-sm cursor-pointer transition-all" style={{ borderColor: `${brand.accent}40` }}>
                      {range}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{(SUBJECTS_DATA[board.id] || SUBJECTS_DATA['default']).length} subjects mapped</span>
                  <Button variant="link" size="sm" className="h-auto p-0 text-[10px]" style={{ color: brand.accent }}>
                    View Syllabus <ChevronRight size={10} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { title: 'CBSE Annual Plan', desc: 'Full year study plan with term-wise breakdowns for CBSE classes 1-12', subjects: 8, classes: 12, downloads: 234 },
            { title: 'ICSE Semester Plan', desc: 'Semester-based planning template for ICSE with weekly milestones', subjects: 9, classes: 10, downloads: 156 },
            { title: 'Board Exam Prep', desc: 'Intensive 3-month revision template for Class 10 & 12 board exams', subjects: 5, classes: 2, downloads: 412 },
            { title: 'Weekly Schedule', desc: 'Customizable weekly class schedule with period allocation', subjects: 6, classes: 12, downloads: 89 },
            { title: 'Summer Enrichment', desc: 'Summer break activity and learning plan templates', subjects: 4, classes: 8, downloads: 67 },
            { title: 'Competitive Exam Prep', desc: 'JEE/NEET/Olympiad preparation schedules with daily targets', subjects: 3, classes: 4, downloads: 198 },
          ].map((tmpl, idx) => (
            <Card key={idx} className="border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all group" data-testid={`template-card-${idx}`}>
              <CardContent className="p-4">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110" style={{ backgroundColor: `${idx % 2 === 0 ? brand.primary : brand.accent}12` }}>
                  <BookOpen size={20} style={{ color: idx % 2 === 0 ? brand.primary : brand.accent }} />
                </div>
                <h4 className="text-sm font-bold mb-1" style={{ color: brand.primary }}>{tmpl.title}</h4>
                <p className="text-[10px] text-muted-foreground mb-3">{tmpl.desc}</p>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-3">
                  <span>{tmpl.subjects} subjects</span>
                  <span>{tmpl.classes} classes</span>
                  <span>{tmpl.downloads} uses</span>
                </div>
                <Button size="sm" className="w-full text-xs h-8 text-white" style={{ backgroundColor: brand.accent }} onClick={() => { toast({ title: 'Template Applied', description: `${tmpl.title} applied to your study plan` }); }} data-testid={`btn-use-template-${idx}`}>
                  Use Template
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedPlan && (
        <Dialog open={!!selectedPlan} onOpenChange={() => setSelectedPlan(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2" style={{ color: brand.primary }}>
                <BookOpen size={18} /> Study Plan: {selectedPlan.subject} - {selectedPlan.classLevel}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Board', value: selectedPlan.board },
                  { label: 'Class', value: selectedPlan.classLevel },
                  { label: 'Subject', value: selectedPlan.subject },
                  { label: 'Batch', value: selectedPlan.batch },
                  { label: 'Type', value: selectedPlan.type },
                  { label: 'Status', value: selectedPlan.status },
                  { label: 'Start Date', value: selectedPlan.startDate },
                  { label: 'End Date', value: selectedPlan.endDate },
                ].map((item, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl border">
                    <p className="text-[10px] text-muted-foreground mb-0.5">{item.label}</p>
                    <p className="text-xs font-semibold" style={{ color: brand.primary }}>{item.value}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: brand.primary }}>Chapter Progress ({selectedPlan.completedChapters}/{selectedPlan.chapters})</p>
                <div className="h-3 rounded-full bg-gray-100">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.round((selectedPlan.completedChapters / selectedPlan.chapters) * 100)}%`, backgroundColor: brand.accent }} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: brand.primary }}>Chapter Breakdown</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {Array.from({ length: selectedPlan.chapters }, (_, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-xl border text-xs">
                      <CheckCircle size={14} style={{ color: i < selectedPlan.completedChapters ? '#4ECDC4' : '#d1d5db' }} />
                      <span className={i < selectedPlan.completedChapters ? 'font-medium' : 'text-muted-foreground'}>
                        Chapter {i + 1}: {selectedPlan.subject} Unit {i + 1}
                      </span>
                      <Badge className={`ml-auto text-[9px] ${i < selectedPlan.completedChapters ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-500'}`}>
                        {i < selectedPlan.completedChapters ? 'Done' : 'Pending'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setSelectedPlan(null)}>Close</Button>
              <Button size="sm" className="text-xs text-white" style={{ backgroundColor: brand.accent }}>Edit Plan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {showCreateModal && (
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-base font-bold" style={{ color: brand.primary }}>Create Study Plan</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Board *</Label>
                  <select className="w-full h-9 text-xs border rounded-md px-2 mt-1" value={createForm.board} onChange={(e) => setCreateForm({ ...createForm, board: e.target.value })} data-testid="create-select-board">
                    <option value="">Select Board</option>
                    {BOARDS_DATA.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Class *</Label>
                  <select className="w-full h-9 text-xs border rounded-md px-2 mt-1" value={createForm.classLevel} onChange={(e) => setCreateForm({ ...createForm, classLevel: e.target.value })} data-testid="create-select-class">
                    <option value="">Select Class</option>
                    {CLASSES_DATA.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Subject *</Label>
                  <select className="w-full h-9 text-xs border rounded-md px-2 mt-1" value={createForm.subject} onChange={(e) => setCreateForm({ ...createForm, subject: e.target.value })} data-testid="create-select-subject">
                    <option value="">Select Subject</option>
                    {(SUBJECTS_DATA[createForm.board] || SUBJECTS_DATA['default']).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Batch *</Label>
                  <select className="w-full h-9 text-xs border rounded-md px-2 mt-1" value={createForm.batch} onChange={(e) => setCreateForm({ ...createForm, batch: e.target.value })} data-testid="create-select-batch">
                    <option value="">Select Batch</option>
                    {BATCHES_DATA.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Start Date</Label>
                  <Input type="date" className="h-9 text-xs mt-1" value={createForm.startDate} onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })} data-testid="create-input-start" />
                </div>
                <div>
                  <Label className="text-xs">End Date</Label>
                  <Input type="date" className="h-9 text-xs mt-1" value={createForm.endDate} onChange={(e) => setCreateForm({ ...createForm, endDate: e.target.value })} data-testid="create-input-end" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Plan Type</Label>
                <div className="flex items-center gap-3 mt-1">
                  {(['custom', 'template'] as const).map(t => (
                    <label key={t} className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input type="radio" name="planType" checked={createForm.type === t} onChange={() => setCreateForm({ ...createForm, type: t })} className="h-3.5 w-3.5" />
                      {t === 'custom' ? 'Custom Plan' : 'From Template'}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowCreateModal(false)}>Cancel</Button>
              <Button size="sm" className="text-xs text-white" style={{ backgroundColor: brand.accent }} onClick={handleCreate} data-testid="btn-submit-create">Create Plan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {showImportModal && (
        <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold" style={{ color: brand.primary }}>Import Study Plans</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-xl p-8 text-center" style={{ borderColor: `${brand.accent}50` }}>
                <Upload size={32} className="mx-auto mb-3" style={{ color: brand.accent }} />
                <p className="text-sm font-semibold mb-1" style={{ color: brand.primary }}>Upload CSV File</p>
                <p className="text-[10px] text-muted-foreground mb-3">Format: Board, Class, Subject, Batch, Start Date, End Date, Chapters</p>
                <label className="cursor-pointer">
                  <input type="file" accept=".csv" className="hidden" onChange={handleImport} data-testid="input-import-csv" />
                  <Button size="sm" className="text-xs text-white" style={{ backgroundColor: brand.accent }} asChild>
                    <span>Choose File</span>
                  </Button>
                </label>
              </div>
              <div className="p-3 rounded-xl border">
                <p className="text-xs font-semibold mb-1" style={{ color: brand.primary }}>CSV Template</p>
                <p className="text-[10px] text-muted-foreground mb-2">Download sample CSV to see the expected format</p>
                <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => {
                  const sample = 'Board,Class,Subject,Batch,Start Date,End Date,Chapters\nCBSE,Class 10,Mathematics,Batch A,2026-01-06,2026-03-15,15\nCBSE,Class 10,Science,Batch A,2026-01-06,2026-03-15,16';
                  const blob = new Blob([sample], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'study_plan_template.csv';
                  a.click();
                  URL.revokeObjectURL(url);
                }} data-testid="btn-download-template">
                  <Download size={10} /> Download Template
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Behavioral Observation Survey Dialog */}
      <Dialog open={showSurveyModal} onOpenChange={setShowSurveyModal}>
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl">
          {surveyStudent && (
            <TeacherCounsellorSurvey
              childId={surveyStudent.id}
              childName={surveyStudent.name}
              observerType="teacher"
              onClose={() => setShowSurveyModal(false)}
              onSubmitted={() => setShowSurveyModal(false)}
            />
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
