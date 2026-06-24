import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { notificationService } from '@/lib/notifications/service';
import type { AdminDashboardContextValue } from '@/contexts/AdminDashboardContext';
import {
  ToggleLeft, Layers, PieChart, Brain, Target, Sparkles, Users, Shield,
  CreditCard, Activity, TrendingUp, Database, Package, Calculator,
  GraduationCap, School, Briefcase, UserCheck, BookOpen, Play, FileCheck,
  Hash, ScrollText, Lock, Wallet, ShieldCheck, Bell, Settings, Cpu,
  FlaskConical, GitBranch, Archive, Scale, Bot, AlertTriangle, Network,
  BarChart2, BarChart3, Building2, UserCircle2, Map, ClipboardList, MessageCircle,
  Search, Sliders, Timer, ClipboardCheck, Shuffle, LineChart, FileDown, Users2,
  Zap, Award, FileText, Route, Star, ArrowRight, LayoutDashboard, LayoutGrid, Gauge, HeartPulse,
  Compass,
} from 'lucide-react';

// Shared formatting utilities (co-located with state to avoid import cycles)
export function formatDate(d?: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
export function formatDateTime(d?: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export function formatCurrency(amount: number | string | null): string {
  if (amount === null || amount === undefined) return '—';
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  return isNaN(n) ? '—' : '₹' + n.toLocaleString('en-IN');
}

const BRAND = { primary: '#344E86', accent: '#4ECDC4', cyan: '#4ECDC4', lightBg: '#f8fafc', dark: '#1e293b', success: '#10b981', warning: '#f59e0b', danger: '#ef4444', purple: '#8b5cf6', indigo: '#6366f1' };

export function useAdminDashboardState(onNavigate?: (screen: string) => void): AdminDashboardContextValue {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    try { return localStorage.getItem('sa_active_tab') || 'mission-control'; } catch { return 'mission-control'; }
  });
  const [crisisPending, setCrisisPending] = useState(0);
  const [actionCenterCount, setActionCenterCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const [psyActiveSection, setPsyActiveSection] = useState<'frameworks' | 'domains' | 'items' | 'modules' | 'custom-modules' | 'competency-framework' | 'tools'>('frameworks');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState('all');
  const [actionDialog, setActionDialog] = useState<{ open: boolean; type: string; item: any }>({ open: false, type: '', item: null });
  const [actionNotes, setActionNotes] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [labsOpen, setLabsOpen] = useState(() => {
    try { return localStorage.getItem('sa_labs_open') === 'true'; } catch { return false; }
  });
  const [userMgmtView, setUserMgmtView] = useState<'users' | 'onboarding'>('users');
  const [securityView, setSecurityView] = useState<'security' | 'audit' | 'access'>('security');
  const [hrSubTab, setHrSubTab] = useState<'jobs' | 'applicants' | 'mentors'>('jobs');
  const [newJobData, setNewJobData] = useState({
    title: '', roleCategory: 'mentor', employmentType: 'part-time', workMode: 'remote',
    eligibility: '', qualifications: '', responsibilities: '', kpis: '', compensationModel: '',
    postToLinkedIn: true, postToIndeed: true, postToNaukri: true, postToFacebook: false,
    postToWhatsApp: false, postToInstagram: false, postToTwitter: false, postToCareers: true,
    posterImage: '', location: '', salary: '', benefits: ''
  });
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [instituteFilter, setInstituteFilter] = useState('all');
  const [financialSubTab, setFinancialSubTab] = useState<'overview' | 'recon' | 'flow' | 'payouts'>('overview');
  const [selectedMentor, setSelectedMentor] = useState<any>(null);
  const [mentorStatusFilter, setMentorStatusFilter] = useState('all');
  const [mentorSearchQuery, setMentorSearchQuery] = useState('');
  const [mentorTypeFilter, setMentorTypeFilter] = useState('all');
  const [mentorAreaFilter, setMentorAreaFilter] = useState('all');
  const [mentorDialog, setMentorDialog] = useState<{ open: boolean; type: string; mentor: any }>({ open: false, type: '', mentor: null });
  const [documentRequestDialog, setDocumentRequestDialog] = useState<{ open: boolean; onboarding: any }>({ open: false, onboarding: null });
  const [requestedDocs, setRequestedDocs] = useState<string[]>([]);
  const [documentRequestMessage, setDocumentRequestMessage] = useState('');
  const [sendingDocRequest, setSendingDocRequest] = useState(false);
  const [generatedUploadUrl, setGeneratedUploadUrl] = useState('');
  const [mentorDialogData, setMentorDialogData] = useState<any>({});
  const [mentorDetailTab, setMentorDetailTab] = useState<'overview' | 'kpis' | 'tasks' | 'payouts' | 'violations'>('overview');
  const [mentorSectionTab, setMentorSectionTab] = useState<'roster' | 'operations'>('roster');
  const [mentorViewMode, setMentorViewMode] = useState<'grid' | 'list'>('grid');
  const [mentorSortBy, setMentorSortBy] = useState<'name' | 'rating' | 'sessions' | 'revenue' | 'phi' | 'joined'>('name');
  const [mentorSelectedIds, setMentorSelectedIds] = useState<Set<number>>(new Set());
  const [mentorBulkActionLoading, setMentorBulkActionLoading] = useState(false);
  const [inviteMentorModal, setInviteMentorModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ fullName: '', email: '', mobile: '', mentorType: 'subject_tutor' });
  const [inviting, setInviting] = useState(false);
  const [mentorNotifyModal, setMentorNotifyModal] = useState(false);
  const [mentorNotifySubject, setMentorNotifySubject] = useState('');
  const [mentorNotifyMessage, setMentorNotifyMessage] = useState('');
  const [sendingMentorNotify, setSendingMentorNotify] = useState(false);
  const [mentorAdjPhiModal, setMentorAdjPhiModal] = useState(false);
  const [mentorPhiValue, setMentorPhiValue] = useState(100);
  const [savingMentorPhi, setSavingMentorPhi] = useState(false);
  const [mentorAssignTaskModal, setMentorAssignTaskModal] = useState(false);
  const [mentorTaskForm, setMentorTaskForm] = useState({ title: '', taskType: 'training', description: '', scheduledDate: '' });
  const [savingMentorTask, setSavingMentorTask] = useState(false);
  const [mentorReportViolationModal, setMentorReportViolationModal] = useState(false);
  const [mentorViolationForm, setMentorViolationForm] = useState({ violationType: 'misconduct', severity: 'minor', description: '' });
  const [savingMentorViolation, setSavingMentorViolation] = useState(false);
  const [mentorProfileSubTab, setMentorProfileSubTab] = useState<'profile' | 'marketplace' | 'responsibilities' | 'bookings' | 'rating' | 'tasks' | 'kpis' | 'agreement' | 'onboarding'>('profile');
  const [mentorProfileModal, setMentorProfileModal] = useState<{ open: boolean; mentor: any | null }>({ open: false, mentor: null });
  const [mentorProfileForm, setMentorProfileForm] = useState<any>({});
  const [savingMentorProfile, setSavingMentorProfile] = useState(false);
  // Parents tab
  const [selectedParent, setSelectedParent] = useState<any>(null);
  const [parentSearch, setParentSearch] = useState('');
  const [parentSubFilter, setParentSubFilter] = useState('all');
  const [parentDetailTab, setParentDetailTab] = useState<'profile' | 'children' | 'bookings' | 'subscription' | 'briefings' | 'activity' | 'consent' | 'kyc'>('profile');
  const [kycAdminAction, setKycAdminAction] = useState<'verify' | 'reject' | null>(null);
  const [kycRejectionReason, setKycRejectionReason] = useState('');
  const [kycAdminNotes, setKycAdminNotes] = useState('');
  const [kycActionLoading, setKycActionLoading] = useState(false);
  const [kycActionFeedback, setKycActionFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [consentEmailSending, setConsentEmailSending] = useState(false);
  const [consentEmailResult, setConsentEmailResult] = useState<{ok: boolean; msg: string} | null>(null);
  const [parentActionLoading, setParentActionLoading] = useState<string | null>(null);
  const [parentActionFeedback, setParentActionFeedback] = useState<{ok: boolean; msg: string} | null>(null);
  const [parentResetPwdOpen, setParentResetPwdOpen] = useState(false);
  const [parentResetPwdValue, setParentResetPwdValue] = useState('');
  const [parentNotifOpen, setParentNotifOpen] = useState(false);
  const [parentNotifMessage, setParentNotifMessage] = useState('');
  // Students tab
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentGradeFilter, setStudentGradeFilter] = useState('all');
  const [studentDetailTab, setStudentDetailTab] = useState<'profile' | 'academic' | 'wellness' | 'lbi' | 'bookings' | 'subscription' | 'consent'>('profile');
  const [studentActionFeedback, setStudentActionFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [studentActionLoading, setStudentActionLoading] = useState<string | null>(null);
  const [studentResetPwdOpen, setStudentResetPwdOpen] = useState(false);
  const [studentResetPwdValue, setStudentResetPwdValue] = useState('');
  const [studentNotifOpen, setStudentNotifOpen] = useState(false);
  const [studentNotifMessage, setStudentNotifMessage] = useState('');
  const [studentRegistryExportOpen, setStudentRegistryExportOpen] = useState(false);
  // Class Roster view
  const [studentsView, setStudentsView] = useState<'registry' | 'class-roster'>('registry');
  const [rosterSchoolFilter, setRosterSchoolFilter] = useState('all');
  const [rosterGradeFilter, setRosterGradeFilter] = useState('all');
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterGroupBy, setRosterGroupBy] = useState<'school' | 'grade'>('school');
  const [rosterExportOpen, setRosterExportOpen] = useState(false);
  // Institutions tab
  const [selectedInstitution, setSelectedInstitution] = useState<any>(null);
  const [institutionSearch, setInstitutionSearch] = useState('');
  const [institutionTypeFilter, setInstitutionTypeFilter] = useState('all');
  const [institutionDetailTab, setInstitutionDetailTab] = useState<'profile' | 'documents' | 'kyc' | 'contacts' | 'activity' | 'code' | 'students'>('profile');
  const [assigningInstCode, setAssigningInstCode] = useState(false);
  const [instStudentsSearch, setInstStudentsSearch] = useState('');
  const [instStudentsGroupBy, setInstStudentsGroupBy] = useState<'grade' | 'none'>('grade');
  const [instAssignPlanModal, setInstAssignPlanModal] = useState<{ open: boolean; student: any | null; isBulk: boolean; grade?: string }>({ open: false, student: null, isBulk: false });
  const [instAssignMentorModal, setInstAssignMentorModal] = useState<{ open: boolean; student: any | null }>({ open: false, student: null });
  const [instSelectedPlanId, setInstSelectedPlanId] = useState('');
  const [instSelectedMentorId, setInstSelectedMentorId] = useState('');
  const [instMentorSlotDate, setInstMentorSlotDate] = useState('');

  const [selectedOnboarding, setSelectedOnboarding] = useState<any>(null);
  const [onboardingSearch, setOnboardingSearch] = useState('');
  const [onboardingSubTab, setOnboardingSubTab] = useState<'requests' | 'kyc' | 'enrollments' | 'enrollment-kyc' | 'mentor-pipeline'>('requests');
  const [selectedEnrollmentKyc, setSelectedEnrollmentKyc] = useState<any>(null);
  const [enrollmentKycSearchQuery, setEnrollmentKycSearchQuery] = useState('');
  const [kycStatusFilter, setKycStatusFilter] = useState('all');
  const [enrollmentStatusFilter, setEnrollmentStatusFilter] = useState('all');
  const [selectedKyc, setSelectedKyc] = useState<any>(null);
  const [selectedEnrollment, setSelectedEnrollment] = useState<any>(null);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [jobStatusFilter, setJobStatusFilter] = useState('all');
  const [applicationStatusFilter, setApplicationStatusFilter] = useState('all');
  const [qbBoardFilter, setQbBoardFilter] = useState('all');
  const [qbClassFilter, setQbClassFilter] = useState('all');
  const [qbSubjectFilter, setQbSubjectFilter] = useState('all');
  const [qbUploadDialog, setQbUploadDialog] = useState(false);
  const [qbUploadFile, setQbUploadFile] = useState<File | null>(null);
  const [qbUploading, setQbUploading] = useState(false);
  const [qbSubTab, setQbSubTab] = useState<'questions' | 'blueprints'>('questions');
  const [seedingEducation, setSeedingEducation] = useState(false);
  const [curriculumImportDialog, setCurriculumImportDialog] = useState(false);
  const [curriculumFile, setCurriculumFile] = useState<File | null>(null);
  const [curriculumUploading, setCurriculumUploading] = useState(false);
  const [aiGenerateDialog, setAiGenerateDialog] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGenerateForm, setAiGenerateForm] = useState({ boardCode: '', classNumber: '', subjectName: '' });
  const [blueprintDialog, setBlueprintDialog] = useState(false);
  const [blueprintData, setBlueprintData] = useState({
    blueprintName: '',
    boardId: '',
    classId: '',
    subjectId: '',
    assessmentType: 'SamplePaper',
    totalMarks: 100,
    duration: 180,
    sections: [] as { sectionName: string; questionType: string; questionsCount: number; marksPerQuestion: number; difficultyMix: string }[]
  });
  const [generatingPaper, setGeneratingPaper] = useState(false);
  const [generatedPaper, setGeneratedPaper] = useState<any>(null);
  
  // Behavior upload state
  const [behaviorUploadDialog, setBehaviorUploadDialog] = useState(false);
  const [behaviorUploadFile, setBehaviorUploadFile] = useState<File | null>(null);
  const [behaviorUploading, setBehaviorUploading] = useState(false);
  const [behaviorUploadProgress, setBehaviorUploadProgress] = useState(0);
  
  // Exam ready upload state
  const [examUploadDialog, setExamUploadDialog] = useState(false);
  const [examUploadFile, setExamUploadFile] = useState<File | null>(null);
  const [examUploading, setExamUploading] = useState(false);
  const [examUploadProgress, setExamUploadProgress] = useState(0);
  const [qbUploadProgress, setQbUploadProgress] = useState(0);
  
  // Psychometric Assessment Framework state
  const [seedingPsychometric, setSeedingPsychometric] = useState(false);
  const [psychoSubTab, setPsychoSubTab] = useState<'overview' | 'domains' | 'agebands' | 'items' | 'framework' | 'custom-modules'>('overview');
  // Domain CRUD state
  const [domainDialog, setDomainDialog] = useState<{ open: boolean; mode: 'create' | 'edit'; domain: any | null }>({ open: false, mode: 'create', domain: null });
  const [domainFormData, setDomainFormData] = useState({ domain_code: '', domain_name: '', description: '', sort_order: 0, is_active: true });
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainDeleteId, setDomainDeleteId] = useState<string | null>(null);
  const [domainDeleting, setDomainDeleting] = useState(false);
  const [selectedDomainCode, setSelectedDomainCode] = useState<string | null>(null);
  const [lbiDomainFilter, setLbiDomainFilter] = useState<string>('all');
  const [compDomainFilter, setCompDomainFilter] = useState<string>('all');
  const [domainSearch, setDomainSearch] = useState('');
  const [compDomainDialog, setCompDomainDialog] = useState<{ open: boolean; domain: any | null }>({ open: false, domain: null });
  const [compDomainFormData, setCompDomainFormData] = useState({ name: '', description: '', sort_order: 0, is_active: true });
  const [compDomainSaving, setCompDomainSaving] = useState(false);
  const [compDomainDeleteId, setCompDomainDeleteId] = useState<string | null>(null);
  const [compDomainDeleting, setCompDomainDeleting] = useState(false);
  // LBI Questions admin state
  const [lbiAdminQSearch, setLbiAdminQSearch] = useState('');
  const [lbiAdminQDomain, setLbiAdminQDomain] = useState('all');
  const [lbiAdminQSubdomain, setLbiAdminQSubdomain] = useState('all');
  const [lbiAdminQAgeBand, setLbiAdminQAgeBand] = useState('all');
  const [lbiAdminQDifficulty, setLbiAdminQDifficulty] = useState('all');
  const [lbiAdminQStatus, setLbiAdminQStatus] = useState('all');
  const [lbiAdminQType, setLbiAdminQType] = useState('all');
  const [lbiAdminQPage, setLbiAdminQPage] = useState(1);
  const [lbiAdminQSelected, setLbiAdminQSelected] = useState<string[]>([]);
  const [lbiAdminQBulkAction, setLbiAdminQBulkAction] = useState('');
  const [lbiAdminQBulkRunning, setLbiAdminQBulkRunning] = useState(false);
  // LBI Question CRUD dialog
  const [lbiQDialog, setLbiQDialog] = useState<{ open: boolean; mode: 'create' | 'edit'; question: any | null }>({ open: false, mode: 'create', question: null });
  const [lbiQFormData, setLbiQFormData] = useState({ question_code: '', domain_code: '', domain_name: '', subdomain_code: '', subdomain_name: '', age_band_code: 'A', question_type: 'likert', question_text: '', difficulty: 'MEDIUM', status: 'Active', is_anchor: false, reverse_scored: false, weight: 1, keying: '', option_a: 'Strongly Disagree', option_b: 'Disagree', option_c: 'Neutral', option_d: 'Agree', option_e: 'Strongly Agree', option_a_score: 1, option_b_score: 2, option_c_score: 3, option_d_score: 4, option_e_score: 5 });
  const [lbiQSaving, setLbiQSaving] = useState(false);
  // Assessment Modules tab state
  const [modulesSearch, setModulesSearch] = useState('');
  const [modulesTypeFilter, setModulesTypeFilter] = useState('all');
  const [modulesStatusFilter, setModulesStatusFilter] = useState('all');
  const [importDialog, setImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [psychoQuestionsDialog, setPsychoQuestionsDialog] = useState(false);
  const [psychoQuestionsFile, setPsychoQuestionsFile] = useState<File | null>(null);
  const [psychoQuestionsUploading, setPsychoQuestionsUploading] = useState(false);
  const [psychoUploadError, setPsychoUploadError] = useState<{ message: string; errors: any[] } | null>(null);
  
  // Exam Question Bank upload state
  const [examQuestionsDialog, setExamQuestionsDialog] = useState(false);
  const [examQuestionsFile, setExamQuestionsFile] = useState<File | null>(null);
  const [examQuestionsUploading, setExamQuestionsUploading] = useState(false);
  const [examQuestionsProgress, setExamQuestionsProgress] = useState(0);
  
  // Exam Ready Question CRUD state
  const [erqSubTab, setErqSubTab] = useState<'list' | 'add'>('list');
  const [erqEditQuestion, setErqEditQuestion] = useState<any>(null);
  const [erqDomainFilter, setErqDomainFilter] = useState('');
  const [erqSubdomainFilter, setErqSubdomainFilter] = useState('');
  const [erqAgeBandFilter, setErqAgeBandFilter] = useState('');
  const [erqTypeFilter, setErqTypeFilter] = useState('');
  const [erqSearch, setErqSearch] = useState('');
  const [erqPage, setErqPage] = useState(1);
  const [erqSaving, setErqSaving] = useState(false);
  const [erqBulkDialog, setErqBulkDialog] = useState(false);
  const [erqBulkFile, setErqBulkFile] = useState<File | null>(null);
  const [erqBulkUploading, setErqBulkUploading] = useState(false);

  // Custom Assessment Module builder state
  const [cmBuilderOpen, setCmBuilderOpen] = useState(false);
  const [cmBuilderStep, setCmBuilderStep] = useState(0);
  const [cmEditModule, setCmEditModule] = useState<any>(null);
  const [cmFormInfo, setCmFormInfo] = useState({ module_code: '', module_name: '', description: '', icon_key: 'Layers', color: '#344E86', category: '', subcategory: '' });
  type CmSubdomainSelection = { subdomain_code: string; subdomain_name: string; question_count: number; question_type: string };
  type CmDomainSelection = { domain_code: string; domain_name: string; subdomains: CmSubdomainSelection[] };
  const [cmSelections, setCmSelections] = useState<CmDomainSelection[]>([]);
  const [cmSaving, setCmSaving] = useState(false);
  const [cmPublishMode, setCmPublishMode] = useState<'draft' | 'published'>('draft');
  const [cmLinkDialog, setCmLinkDialog] = useState<{ open: boolean; module: any | null }>({ open: false, module: null });
  const [cmLinkPackageIds, setCmLinkPackageIds] = useState<string[]>([]);
  const [cmDomainPicker, setCmDomainPicker] = useState('');
  const [cmSubdomainPicker, setCmSubdomainPicker] = useState('');
  const [cmDeleteConfirm, setCmDeleteConfirm] = useState<number | null>(null);
  const defaultCmSettings = {
    include_anchor_questions: true,
    age_bands: [] as string[],
    difficulty: 'all',
    item_selection: 'random',
    time_restricted: false,
    time_limit_minutes: 30,
    allow_save_resume: false,
    auto_reassign_on_abandon: true,
    anti_cheat: {
      randomize_question_order: true,
      randomize_option_order: false,
      no_back_navigation: false,
      full_screen_required: false,
      tab_switch_detection: true,
      max_tab_switches: 3,
      copy_paste_disabled: true,
    },
    allow_answer_change: true,
    max_attempts: 1,
    show_results_immediately: true,
    passing_score_pct: null as number | null,
    instructions: '',
  };
  const [cmSettings, setCmSettings] = useState({ ...defaultCmSettings, anti_cheat: { ...defaultCmSettings.anti_cheat } });
  const [erqFormData, setErqFormData] = useState({
    question_id: '', domain_code: '', domain_name: '', subdomain_code: '', subdomain_name: '',
    age_band: 'A', question_type: 'likert', statement: '', passage_text: '',
    options: [
      { id: 'A', text: 'Strongly Disagree', score: 1 },
      { id: 'B', text: 'Disagree', score: 2 },
      { id: 'C', text: 'Neutral', score: 3 },
      { id: 'D', text: 'Agree', score: 4 },
      { id: 'E', text: 'Strongly Agree', score: 5 },
    ] as { id: string; text: string; score: number }[],
    correct_answer: '', reverse_scoring: false, anchor: 'Yes', weight: 1,
    difficulty: '', status: 'Active',
  });

  // LBI Question Bank upload state
  const [lbiQuestionsDialog, setLbiQuestionsDialog] = useState(false);
  const [lbiQuestionsFile, setLbiQuestionsFile] = useState<File | null>(null);
  const [lbiQuestionsUploading, setLbiQuestionsUploading] = useState(false);
  const [lbiUploadError, setLbiUploadError] = useState<{ message: string; errors: any[] } | null>(null);
  const [settingsSubTab, setSettingsSubTab] = useState<'general' | 'security' | 'notifications' | 'integrations' | 'compliance'>('general');
  const [settingsSaving, setSettingsSaving] = useState<string | null>(null);
  const [pricingCategoryFilter, setPricingCategoryFilter] = useState('all');
  const [assessmentDomains, setAssessmentDomains] = useState<any[]>([]);
  const [expandedDomainId, setExpandedDomainId] = useState<number | null>(null);
  const [domainSubdomains, setDomainSubdomains] = useState<Record<number, any[]>>({});
  const [editingPackageDomains, setEditingPackageDomains] = useState<{ packageId: string; packageName: string; domainIds: number[] } | null>(null);
  const [documentSearch, setDocumentSearch] = useState('');
  const [documentStatusFilter, setDocumentStatusFilter] = useState('all');
  const [documentEntityFilter, setDocumentEntityFilter] = useState('all');
  const [securityIncidentFilter, setSecurityIncidentFilter] = useState('all');
  const [auditCategoryFilter, setAuditCategoryFilter] = useState('all');
  const [auditDateFrom, setAuditDateFrom] = useState('');
  const [auditDateTo, setAuditDateTo] = useState('');
  const [auditExportFormat, setAuditExportFormat] = useState('csv');
  const [broadcastType, setBroadcastType] = useState<'fyi' | 'fya'>('fyi');
  const [broadcastCategory, setBroadcastCategory] = useState('system');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastPriority, setBroadcastPriority] = useState('normal');
  const [broadcastTargetRoles, setBroadcastTargetRoles] = useState<string[]>([]);
  const [broadcastActionUrl, setBroadcastActionUrl] = useState('');
  const [broadcastSendEmail, setBroadcastSendEmail] = useState(false);
  const [notifSubTab, setNotifSubTab] = useState<'broadcasts' | 'templates' | 'quicksend' | 'analytics' | 'auditlogs' | 'scenarios' | 'scheduled'>('broadcasts');
  const [pauseFrom, setPauseFrom] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().split('T')[0];
  });
  const [pauseTo, setPauseTo] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState('all');
  const [templateExpandedId, setTemplateExpandedId] = useState<number | null>(null);
  const [templateDialog, setTemplateDialog] = useState<{ open: boolean; mode: 'create' | 'edit'; template: any | null }>({ open: false, mode: 'create', template: null });
  const [templateFormData, setTemplateFormData] = useState({ title: '', category: 'general', bodyTemplate: '', type: 'fyi', priority: 'normal', roles: 'all', variables: '', actionLabel: '' });
  const [templateSaving, setTemplateSaving] = useState(false);
  const [quickSendTemplateId, setQuickSendTemplateId] = useState('');
  const [quickSendRecipientId, setQuickSendRecipientId] = useState('');
  const [quickSendContext, setQuickSendContext] = useState<Record<string, string>>({});
  const [quickSendSending, setQuickSendSending] = useState(false);
  const [notifLogCategoryFilter, setNotifLogCategoryFilter] = useState('all');
  const [notifLogTypeFilter, setNotifLogTypeFilter] = useState('all');
  const [notifLogPriorityFilter, setNotifLogPriorityFilter] = useState('all');
  const [notifLogExpandedId, setNotifLogExpandedId] = useState<number | null>(null);
  const [reportIncidentDialog, setReportIncidentDialog] = useState(false);
  const [newIncidentData, setNewIncidentData] = useState({ title: '', description: '', severity: 'low', incidentType: '' });
  const [editPackageDialog, setEditPackageDialog] = useState(false);
  const [createPackageDialog, setCreatePackageDialog] = useState(false);
  const [pkgWizardStep, setPkgWizardStep] = useState(0);
  const [editPackageData, setEditPackageData] = useState<any>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const EMPTY_PKG = {
    productName: '',
    category: '',
    subcategory: '',
    description: '',
    subscriptionType: 'one_time' as string,
    studentSegment: 'Any Class',
    studentSegmentCode: 'UNIVERSAL' as string,
    ageBandCodes: [] as string[],
    domainConfig: [] as Array<{ domainCode: string; domainName: string; subdomains: Array<{ code: string; name: string; count: number }> }>,
    domainsCovered: [] as string[],
    highlights: [] as string[],
    originalPrice: '' as string,
    discountPct: '' as string,
    offerLabel: '' as string,
    couponCode: '' as string,
    couponDiscountPct: '' as string,
    trialDays: '' as string,
    scholarshipEnabled: false,
    scholarshipPct: '' as string,
    questionDrawMode: 'random' as string,
    difficultyDistribution: { easy: 30, medium: 50, hard: 20 },
    includeAnchorQuestions: true,
    mentorAddOn: { enabled: false, sessions: 1, duration: 60, mentorType: 'subject_tutor' },
    maxAttempts: 1,
    assessmentMode: 'online' as string,
    price: '',
    validityDays: '',
    questionCount: '',
    reportType: 'Basic',
    isRecommended: false,
    isActive: true,
    sortOrder: 0,
  };
  const [newPackageData, setNewPackageData] = useState({ ...EMPTY_PKG });
  const [newPkgCatMode, setNewPkgCatMode] = useState(false);
  const [editPkgCatMode, setEditPkgCatMode] = useState(false);
  const [newPkgSubCatMode, setNewPkgSubCatMode] = useState(false);
  const [editPkgSubCatMode, setEditPkgSubCatMode] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Persist active tab and labs state to localStorage
  useEffect(() => { try { localStorage.setItem('sa_active_tab', activeTab); } catch {} }, [activeTab]);
  useEffect(() => { try { localStorage.setItem('sa_labs_open', String(labsOpen)); } catch {} }, [labsOpen]);

  // Redirect legacy standalone tab IDs into their merged parent tabs (also catches runtime navigation)
  useEffect(() => {
    if (activeTab === 'onboarding') { setActiveTab('usermgmt'); setUserMgmtView('onboarding'); }
    if (activeTab === 'audit')      { setActiveTab('security'); setSecurityView('audit'); }
  }, [activeTab]);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/user', { credentials: 'include' });
        if (res.ok) {
          const user = await res.json();
          if (user.role === 'super_admin' || user.roles?.includes('super_admin')) {
            setIsAuthenticated(true);
          }
        }
      } catch (e) {
        console.error('Auth check failed:', e);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    checkAuth();
  }, []);

  // Poll crisis escalation count every 30 seconds
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchCrisis = async () => {
      try {
        const res = await fetch('/api/admin/rie/escalations/unread', { credentials: 'include' });
        if (res.ok) { const d = await res.json(); setCrisisPending(d.count || 0); }
      } catch {}
    };
    fetchCrisis();
    const id = setInterval(fetchCrisis, 30000);
    return () => clearInterval(id);
  }, [isAuthenticated]);

  // Poll Action Center pending count every 60 seconds
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchActions = async () => {
      try {
        const res = await fetch('/api/admin/action-center/summary', { credentials: 'include' });
        if (res.ok) { const d = await res.json(); setActionCenterCount(d.total || 0); }
      } catch {}
    };
    fetchActions();
    const id = setInterval(fetchActions, 60000);
    return () => clearInterval(id);
  }, [isAuthenticated]);

  // Poll Notification Center critical+warning count every 60 seconds
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchNotifications = async () => {
      try {
        const res = await fetch('/api/admin/notifications/summary', { credentials: 'include' });
        if (res.ok) {
          const d = await res.json();
          setNotificationCount((d.by_severity?.critical || 0) + (d.by_severity?.warning || 0));
        }
      } catch {}
    };
    fetchNotifications();
    const id = setInterval(fetchNotifications, 60000);
    return () => clearInterval(id);
  }, [isAuthenticated]);

  // Logout handler
  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {
      console.error('Logout error:', e);
    }
    localStorage.removeItem('metryx_token');
    setIsAuthenticated(false);
    window.location.href = '/';
  };

  // Fetch stats
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['/api/admin/dashboard/stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/dashboard/stats', { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isAuthenticated
  });

  // Simulation & Validation harness flag — when OFF the nav item self-hides
  // (the panel renders nothing and the admin routes return 503).
  const { data: simHarnessEnabled = false } = useQuery<boolean>({
    queryKey: ['/api/admin/simulation/config', 'enabled'],
    queryFn: async () => {
      const res = await fetch('/api/admin/simulation/config', { credentials: 'include' });
      if (!res.ok) return false;
      const j = await res.json().catch(() => null);
      return !!j?.enabled;
    },
    enabled: isAuthenticated,
  });

  // Phase 6.6 Revenue Intelligence flag — when OFF the /ping probe 503s and the
  // "Revenue" nav item self-hides, keeping the flag-OFF UI byte-identical to legacy.
  const { data: revenueIntelEnabled = false } = useQuery<boolean>({
    queryKey: ['/api/admin/commercial/revenue/ping', 'enabled'],
    queryFn: async () => {
      const res = await fetch('/api/admin/commercial/revenue/ping', { credentials: 'include' });
      return res.ok;
    },
    enabled: isAuthenticated,
  });

  // Phase 6.8 Customer Success Intelligence flag — when OFF the /ping probe 503s
  // and the "Customer Success" nav item self-hides, keeping flag-OFF byte-identical.
  const { data: customerSuccessEnabled = false } = useQuery<boolean>({
    queryKey: ['/api/admin/commercial/success/ping', 'enabled'],
    queryFn: async () => {
      const res = await fetch('/api/admin/commercial/success/ping', { credentials: 'include' });
      return res.ok;
    },
    enabled: isAuthenticated,
  });

  // MX-75X Outcome Validation console flag (validationLoop) — when OFF the /status probe
  // 503s and the "Outcome Validation" nav item self-hides, keeping flag-OFF byte-identical.
  const { data: outcomeValidationEnabled = false } = useQuery<boolean>({
    queryKey: ['/api/validation-loop/status', 'enabled'],
    queryFn: async () => {
      const res = await fetch('/api/validation-loop/status', { credentials: 'include' });
      return res.ok;
    },
    enabled: isAuthenticated,
  });

  // Phase 6.9 Enterprise Governance console flag — when OFF the /console/ping probe
  // 503s and the "Enterprise Governance" nav item self-hides, keeping flag-OFF byte-identical.
  const { data: enterpriseGovernanceEnabled = false } = useQuery<boolean>({
    queryKey: ['/api/admin/governance/console/ping', 'enabled'],
    queryFn: async () => {
      const res = await fetch('/api/admin/governance/console/ping', { credentials: 'include' });
      return res.ok;
    },
    enabled: isAuthenticated,
  });

  // Phase 6.10 Platform Intelligence console flag — when OFF the /console/ping probe
  // 503s and the "Platform Intelligence" nav item self-hides, keeping flag-OFF byte-identical.
  const { data: platformIntelligenceEnabled = false } = useQuery<boolean>({
    queryKey: ['/api/admin/platform/console/ping', 'enabled'],
    queryFn: async () => {
      const res = await fetch('/api/admin/platform/console/ping', { credentials: 'include' });
      return res.ok;
    },
    enabled: isAuthenticated,
  });

  // Phase 6.11 Multi-Tenant Architecture console flag — when OFF the /console/ping probe
  // 503s and the "Multi-Tenant Architecture" nav item self-hides, keeping flag-OFF byte-identical.
  const { data: tenantArchitectureEnabled = false } = useQuery<boolean>({
    queryKey: ['/api/admin/tenant-architecture/console/ping', 'enabled'],
    queryFn: async () => {
      const res = await fetch('/api/admin/tenant-architecture/console/ping', { credentials: 'include' });
      return res.ok;
    },
    enabled: isAuthenticated,
  });

  // Phase 6.13 Automation Engine console flag — when OFF the /console/ping probe
  // 503s and the "Automation Engine" nav item self-hides, keeping flag-OFF byte-identical.
  const { data: automationEngineEnabled = false } = useQuery<boolean>({
    queryKey: ['/api/admin/automation/console/ping', 'enabled'],
    queryFn: async () => {
      const res = await fetch('/api/admin/automation/console/ping', { credentials: 'include' });
      return res.ok;
    },
    enabled: isAuthenticated,
  });

  // Phase 6.14 Command Center console flag — when OFF the /console/ping probe
  // 503s and the "Command Center" nav item self-hides, keeping flag-OFF byte-identical.
  const { data: commandCenterEnabled = false } = useQuery<boolean>({
    queryKey: ['/api/admin/command-center/console/ping', 'enabled'],
    queryFn: async () => {
      const res = await fetch('/api/admin/command-center/console/ping', { credentials: 'include' });
      return res.ok;
    },
    enabled: isAuthenticated,
  });

  // Phase 6.15 Founder Control Center console flag — when OFF the /console/ping probe
  // 503s and the "Founder Control Center" nav item self-hides, keeping flag-OFF byte-identical.
  const { data: founderControlCenterEnabled = false } = useQuery<boolean>({
    queryKey: ['/api/admin/founder-control-center/console/ping', 'enabled'],
    queryFn: async () => {
      const res = await fetch('/api/admin/founder-control-center/console/ping', { credentials: 'include' });
      return res.ok;
    },
    enabled: isAuthenticated,
  });

  // Governance & Security (RBAC/Audit) flag — when OFF the route 503s and the
  // nav item self-hides, keeping the flag-OFF UI byte-identical to legacy.
  const { data: governanceEnabled = false } = useQuery<boolean>({
    queryKey: ['/api/admin/governance/status', 'enabled'],
    queryFn: async () => {
      const res = await fetch('/api/admin/governance/status', { credentials: 'include' });
      return res.ok;
    },
    enabled: isAuthenticated,
  });

  // Competency Runtime flag (competencyRuntime) — when OFF the gated routes 503
  // and the nav item self-hides, keeping the flag-OFF UI byte-identical to legacy.
  const { data: competencyRuntimeEnabled = false } = useQuery<boolean>({
    queryKey: ['/api/competency-runtime/competency-types/report', 'enabled'],
    queryFn: async () => {
      const res = await fetch('/api/competency-runtime/competency-types/report', { credentials: 'include' });
      return res.ok;
    },
    enabled: isAuthenticated,
  });

  // Competency Employability Intelligence flag (competencyEi) — when OFF the
  // gated routes 503 and the nav item self-hides, keeping flag-OFF byte-identical.
  const { data: competencyEiEnabled = false } = useQuery<boolean>({
    queryKey: ['/api/competency-ei/admin/overview', 'enabled'],
    queryFn: async () => {
      const res = await fetch('/api/competency-ei/admin/overview', { credentials: 'include' });
      return res.ok;
    },
    enabled: isAuthenticated,
  });

  // Career Intelligence flag (careerIntelligence) — when OFF the gated probe
  // 503s and the nav item self-hides, keeping flag-OFF byte-identical.
  const { data: careerIntelligenceEnabled = false } = useQuery<boolean>({
    queryKey: ['/api/career-intelligence/_meta/status', 'enabled'],
    queryFn: async () => {
      const res = await fetch('/api/career-intelligence/_meta/status', { credentials: 'include' });
      return res.ok;
    },
    enabled: isAuthenticated,
  });

  // Usage Metering flag (commercialUsageMetering) — when OFF the gated admin
  // route 503s and the nav item self-hides, keeping flag-OFF byte-identical.
  const { data: usageMeteringEnabled = false } = useQuery<boolean>({
    queryKey: ['/api/admin/commercial/metering/dimensions', 'enabled'],
    queryFn: async () => {
      const res = await fetch('/api/admin/commercial/metering/dimensions', { credentials: 'include' });
      return res.ok;
    },
    enabled: isAuthenticated,
  });

  // Fetch platform settings
  const { data: platformSettingsData = [], refetch: refetchSettings } = useQuery<any[]>({
    queryKey: ['/api/admin/platform-settings'],
    queryFn: async () => {
      const res = await fetch('/api/admin/platform-settings', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && activeTab === 'settings'
  });

  const getSettingValue = (key: string, defaultValue: string = ''): string => {
    const setting = platformSettingsData.find((s: any) => s.key === key);
    return setting?.value ?? defaultValue;
  };

  const getSettingBool = (key: string, defaultValue: boolean = false): boolean => {
    const val = getSettingValue(key, String(defaultValue));
    return val === 'true';
  };

  const updateSetting = async (key: string, value: string, type: string = 'string', category: string = 'general', description?: string) => {
    setSettingsSaving(key);
    try {
      const res = await fetch('/api/admin/platform-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ settings: [{ key, value, category, description }] }),
      });
      if (!res.ok) throw new Error('Failed to update');
      queryClient.invalidateQueries({ queryKey: ['/api/admin/platform-settings'] });
      toast({ title: 'Setting Updated', description: `${key.replace(/_/g, ' ')} has been updated.` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSettingsSaving(null);
    }
  };

  const seedDefaultSettings = async () => {
    try {
      const res = await fetch('/api/admin/platform-settings/seed-defaults', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to seed defaults');
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ['/api/admin/platform-settings'] });
      toast({ title: 'Settings Initialized', description: result.message });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Fetch data for tabs
  const { data: onboardingApprovals = [], refetch: refetchOnboarding } = useQuery<any[]>({
    queryKey: ['/api/admin/onboarding', statusFilter, entityTypeFilter],
    queryFn: async () => {
      let params = [];
      if (statusFilter !== 'all') params.push(`status=${statusFilter}`);
      if (entityTypeFilter !== 'all') params.push(`entityType=${entityTypeFilter}`);
      const queryString = params.length > 0 ? `?${params.join('&')}` : '';
      const res = await fetch(`/api/admin/onboarding${queryString}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated
  });

  const { data: entityCodes = [], refetch: refetchCodes } = useQuery<any[]>({
    queryKey: ['/api/admin/entity-codes', entityTypeFilter],
    queryFn: async () => {
      let params = entityTypeFilter !== 'all' ? `?entityType=${entityTypeFilter}` : '';
      const res = await fetch(`/api/admin/entity-codes${params}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated
  });

  const { data: consents = [], refetch: refetchConsents } = useQuery<any[]>({
    queryKey: ['/api/admin/consents', statusFilter],
    queryFn: async () => {
      let params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const res = await fetch(`/api/admin/consents${params}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated
  });

  const { data: documentsData = [], isLoading: documentsLoading, refetch: refetchDocuments } = useQuery<any[]>({
    queryKey: ['/api/admin/documents', documentStatusFilter, documentEntityFilter, documentSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (documentStatusFilter !== 'all') params.append('status', documentStatusFilter);
      if (documentEntityFilter !== 'all') params.append('entityType', documentEntityFilter);
      if (documentSearch) params.append('search', documentSearch);
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/admin/documents${queryString}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated
  });

  const { data: auditLogs = [], refetch: refetchAuditLogs } = useQuery<any[]>({
    queryKey: ['/api/admin/audit-logs', auditCategoryFilter, auditDateFrom, auditDateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('limit', '100');
      if (auditCategoryFilter !== 'all') params.append('targetType', auditCategoryFilter);
      if (auditDateFrom) params.append('startDate', auditDateFrom);
      if (auditDateTo) params.append('endDate', auditDateTo);
      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data.logs || []);
    },
    enabled: isAuthenticated
  });

  const { data: securityConfig = [], refetch: refetchSecurityConfig } = useQuery<any[]>({
    queryKey: ['/api/admin/security/config'],
    queryFn: async () => {
      const res = await fetch('/api/admin/security/config', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && (activeTab === 'security')
  });

  const { data: securityIncidents = [], refetch: refetchSecurityIncidents } = useQuery<any[]>({
    queryKey: ['/api/admin/security/incidents', securityIncidentFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (securityIncidentFilter !== 'all') params.append('status', securityIncidentFilter);
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/admin/security/incidents${queryString}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && (activeTab === 'security')
  });

  const { data: retentionPolicies = [], refetch: refetchRetentionPolicies } = useQuery<any[]>({
    queryKey: ['/api/admin/security/retention-policies'],
    queryFn: async () => {
      const res = await fetch('/api/admin/security/retention-policies', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && (activeTab === 'security')
  });

  const { data: accessPolicies = [], refetch: refetchAccessPolicies } = useQuery<any[]>({
    queryKey: ['/api/admin/security/access-policies'],
    queryFn: async () => {
      const res = await fetch('/api/admin/security/access-policies', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && (activeTab === 'security')
  });

  const { data: reconciliations = [], refetch: refetchReconciliations } = useQuery<any[]>({
    queryKey: ['/api/admin/reconciliations'],
    queryFn: async () => {
      const res = await fetch('/api/admin/reconciliations', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated
  });

  const { data: learningPlans = [], refetch: refetchLearningPlans } = useQuery<any[]>({
    queryKey: ['/api/admin/learning-plans'],
    queryFn: async () => {
      const res = await fetch('/api/admin/learning-plans', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated
  });

  // Learning Behavior (Lbi/LBI) data
  const { data: behaviorData = { insights: [], stats: { total: 0, thisMonth: 0, avgScore: 0, categories: [] } }, refetch: refetchBehaviorData } = useQuery<any>({
    queryKey: ['/api/admin/behavior-insights'],
    queryFn: async () => {
      const res = await fetch('/api/admin/behavior-insights', { credentials: 'include' });
      if (!res.ok) return { insights: [], stats: { total: 0, thisMonth: 0, avgScore: 0, categories: [] } };
      return res.json();
    },
    enabled: isAuthenticated
  });

  // Psychometric Assessment Framework data
  const { data: psychoAgeBands = [], refetch: refetchAgeBands } = useQuery<any[]>({
    queryKey: ['/api/admin/psychometric/age-bands'],
    queryFn: async () => {
      const res = await fetch('/api/admin/psychometric/age-bands', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated
  });

  const { data: psychoDomains = [], refetch: refetchDomains } = useQuery<any[]>({
    queryKey: ['/api/admin/psychometric/domains'],
    queryFn: async () => {
      const res = await fetch('/api/admin/psychometric/domains', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated
  });

  const { data: psychoConfigs = [], refetch: refetchConfigs } = useQuery<any[]>({
    queryKey: ['/api/admin/psychometric/config'],
    queryFn: async () => {
      const res = await fetch('/api/admin/psychometric/config', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated
  });

  // Psychometric Questions data
  const [psychoQuestionFilter, setPsychoQuestionFilter] = useState<{ domainId?: string; ageBandId?: string }>({});
  const { data: psychoQuestions = [], refetch: refetchPsychoQuestions } = useQuery<any[]>({
    queryKey: ['/api/admin/psychometric/questions', psychoQuestionFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (psychoQuestionFilter.domainId) params.append('domainId', psychoQuestionFilter.domainId);
      if (psychoQuestionFilter.ageBandId) params.append('ageBandId', psychoQuestionFilter.ageBandId);
      const res = await fetch(`/api/admin/psychometric/questions?${params}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated
  });

  // LBI Framework data
  const { data: lbiDomains = [], refetch: refetchLbiDomains } = useQuery<any[]>({
    queryKey: ['/api/lbi/domains'],
    queryFn: async () => {
      const res = await fetch('/api/lbi/domains', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated
  });

  const { data: competencyDomains = [], refetch: refetchCompetencyDomains } = useQuery<any[]>({
    queryKey: ['/api/competency/domains', 'with-subdomains'],
    queryFn: async () => {
      const res = await fetch('/api/competency/domains?include=subdomains', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated
  });

  const { data: lbiAgeBands = [], refetch: refetchLbiAgeBands } = useQuery<any[]>({
    queryKey: ['/api/lbi/age-bands'],
    queryFn: async () => {
      const res = await fetch('/api/lbi/age-bands', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated
  });

  const [lbiQuestionFilter, setLbiQuestionFilter] = useState<{ domainId?: string; ageBandId?: string; difficulty?: string }>({});
  const { data: lbiQuestions = [], refetch: refetchLbiQuestions } = useQuery<any[]>({
    queryKey: ['/api/lbi/questions', lbiQuestionFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (lbiQuestionFilter.domainId) params.append('domainId', lbiQuestionFilter.domainId);
      if (lbiQuestionFilter.ageBandId) params.append('ageBandId', lbiQuestionFilter.ageBandId);
      if (lbiQuestionFilter.difficulty) params.append('difficulty', lbiQuestionFilter.difficulty);
      const res = await fetch(`/api/lbi/questions?${params}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated
  });

  // LBI Admin: questions with full filters, pagination
  const { data: lbiAdminQuestions = { questions: [], total: 0, page: 1, totalPages: 1, limit: 50 }, refetch: refetchLbiAdminQ, isFetching: lbiAdminQLoading } = useQuery<any>({
    queryKey: ['/api/lbi/admin/questions-all', lbiAdminQDomain, lbiAdminQSubdomain, lbiAdminQAgeBand, lbiAdminQDifficulty, lbiAdminQStatus, lbiAdminQType, lbiAdminQSearch, lbiAdminQPage],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (lbiAdminQDomain !== 'all') p.append('domain_code', lbiAdminQDomain);
      if (lbiAdminQSubdomain !== 'all') p.append('subdomain_code', lbiAdminQSubdomain);
      if (lbiAdminQAgeBand !== 'all') p.append('age_band', lbiAdminQAgeBand);
      if (lbiAdminQDifficulty !== 'all') p.append('difficulty', lbiAdminQDifficulty);
      if (lbiAdminQStatus !== 'all') p.append('status', lbiAdminQStatus);
      if (lbiAdminQType !== 'all') p.append('question_type', lbiAdminQType);
      if (lbiAdminQSearch) p.append('search', lbiAdminQSearch);
      p.append('page', String(lbiAdminQPage));
      const res = await fetch(`/api/lbi/admin/questions-all?${p}`, { credentials: 'include' });
      if (!res.ok) return { questions: [], total: 0, page: 1, totalPages: 1, limit: 50 };
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 30000,
  });

  // Custom Assessment Modules
  const { data: customAssessmentModules = [], refetch: refetchCustomModules } = useQuery<any[]>({
    queryKey: ['/api/lbi/admin/custom-modules'],
    queryFn: async () => {
      const res = await fetch('/api/lbi/admin/custom-modules', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated,
  });

  // LBI Admin: ALL subdomains (small dataset, fetched once, filtered client-side
  // by various callers using s.domain_code). DO NOT pass `lbiAdminQDomain` here —
  // that variable belongs to the Items panel filter, not the subdomain list.
  const { data: lbiAdminSubdomains = [], refetch: refetchLbiSubdomains } = useQuery<any[]>({
    queryKey: ['/api/lbi/admin/subdomains'],
    queryFn: async () => {
      const res = await fetch(`/api/lbi/admin/subdomains`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated,
  });

  // CAPADEX — 18 domains
  const { data: sdiDomains = [] } = useQuery<any[]>({
    queryKey: ['/api/sdi/admin/domains'],
    queryFn: async () => {
      const res = await fetch(`/api/sdi/admin/domains`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated,
  });

  // LBI Admin: overview stats
  const { data: lbiAdminStats = { domains: { total: 0, active: 0 }, questions: { total: 0, active: 0 }, subdomains: { total: 0 }, ageBands: { total: 0 } }, refetch: refetchLbiStats } = useQuery<any>({
    queryKey: ['/api/lbi/admin/stats'],
    queryFn: async () => {
      const res = await fetch('/api/lbi/admin/stats', { credentials: 'include' });
      if (!res.ok) return { domains: { total: 0, active: 0 }, questions: { total: 0, active: 0 }, subdomains: { total: 0 }, ageBands: { total: 0 } };
      return res.json();
    },
    enabled: isAuthenticated,
  });

  // Exam Ready Questions CRUD data
  const { data: erqData = { questions: [], total: 0, page: 1, totalPages: 0, filters: { domains: [], subdomains: [], ageBands: [], questionTypes: [] } }, refetch: refetchErqData } = useQuery<any>({
    queryKey: ['/api/admin/exam-ready/questions', erqDomainFilter, erqSubdomainFilter, erqAgeBandFilter, erqTypeFilter, erqSearch, erqPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (erqDomainFilter) params.append('domain_code', erqDomainFilter);
      if (erqSubdomainFilter) params.append('subdomain_code', erqSubdomainFilter);
      if (erqAgeBandFilter) params.append('age_band', erqAgeBandFilter);
      if (erqTypeFilter) params.append('question_type', erqTypeFilter);
      if (erqSearch) params.append('search', erqSearch);
      params.append('page', String(erqPage));
      params.append('limit', '25');
      const res = await fetch(`/api/admin/exam-ready/questions?${params}`, { credentials: 'include' });
      if (!res.ok) return { questions: [], total: 0, page: 1, totalPages: 0, filters: { domains: [], subdomains: [], ageBands: [], questionTypes: [] } };
      return res.json();
    },
    enabled: isAuthenticated && activeTab === 'behavior' && psyActiveSection === 'items'
  });

  // ExamReadiness Index data
  const { data: examReadyData = { exams: [], stats: { total: 0, thisMonth: 0, avgScore: 0, passRate: 0, subjects: [] } }, refetch: refetchExamReadyData } = useQuery<any>({
    queryKey: ['/api/admin/exam-ready'],
    queryFn: async () => {
      const res = await fetch('/api/admin/exam-ready', { credentials: 'include' });
      if (!res.ok) return { exams: [], stats: { total: 0, thisMonth: 0, avgScore: 0, passRate: 0, subjects: [] } };
      return res.json();
    },
    enabled: isAuthenticated
  });

  // Booking & Assignments state
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState('all');
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignChildId, setAssignChildId] = useState('');
  const [assignPackageId, setAssignPackageId] = useState('');
  const [assignAgeBandFilter, setAssignAgeBandFilter] = useState('');
  const [assignSubTypeFilter, setAssignSubTypeFilter] = useState('');
  const [assignInstitutionFilter, setAssignInstitutionFilter] = useState('');
  const [assignStartDate, setAssignStartDate] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState<any>(null);
  const [assignConflict, setAssignConflict] = useState<any>(null);
  const [assignPkgSearch, setAssignPkgSearch] = useState('');
  const [assignMode, setAssignMode] = useState<'individual' | 'bulk'>('individual');
  const [assignChildSearch, setAssignChildSearch] = useState('');
  const [assignPkgSort, setAssignPkgSort] = useState<'recommended' | 'price_asc' | 'price_desc'>('recommended');

  // Subscription Packages data
  const [seedingPackages, setSeedingPackages] = useState(false);
  const [scoringSubTab, setScoringSubTab] = useState('registry');
  const [calcModule, setCalcModule] = useState('les');
  const [calcInputs, setCalcInputs] = useState<Record<string,string>>({});
  const [calcResult, setCalcResult] = useState<any>(null);
  const [expandedModule, setExpandedModule] = useState<string|null>(null);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishChoice, setPublishChoice] = useState<'draft'|'live'>('live');
  const [publishStatus, setPublishStatus] = useState<'idle'|'publishing'|'done'>('idle');
  const [configVersion] = useState('v3.2');
  const [configApproval, setConfigApproval] = useState<'draft'|'pending'|'approved'>('approved');
  const [auditLog, setAuditLog] = useState([
    { timestamp:'2025-01-15 14:23', user:'Dr. R. Mehta',     action:'Updated',   module:'Age Bands',     details:'Band C — P60: 62 → 65',                      type:'Norm'    },
    { timestamp:'2025-01-15 14:20', user:'Dr. R. Mehta',     action:'Updated',   module:'Domain Config', details:'Working Memory domain weight: 30% → 35%',     type:'Domain'  },
    { timestamp:'2025-01-14 11:05', user:'S. Kapoor',        action:'Updated',   module:'ATT',           details:'stability_weight: 0.55 → 0.60',               type:'Formula' },
    { timestamp:'2025-01-14 10:48', user:'S. Kapoor',        action:'Added',     module:'Domain Config', details:'Learning & Strategy / Study Strategy Profile', type:'Domain'  },
    { timestamp:'2025-01-10 09:30', user:'A. Krishnamurthy', action:'Published', module:'ENGINE',        details:'Config v3.1 → v3.2 published (Live)',          type:'Publish' },
    { timestamp:'2025-01-08 16:12', user:'A. Krishnamurthy', action:'Updated',   module:'Age Bands',     details:'Band E2 — P80: 84 → 86',                     type:'Norm'    },
    { timestamp:'2025-01-08 15:55', user:'S. Kapoor',        action:'Updated',   module:'MEM',           details:'enc_weight: 0.45 → 0.40',                    type:'Formula' },
    { timestamp:'2024-11-20 13:00', user:'A. Krishnamurthy', action:'Published', module:'ENGINE',        details:'Config v3.0 → v3.1 published (Live)',          type:'Publish' },
    { timestamp:'2024-11-18 10:22', user:'Dr. R. Mehta',     action:'Updated',   module:'Domain Config', details:'Exam Preparedness domain weight: 35% → 40%',  type:'Domain'  },
    { timestamp:'2024-11-15 09:10', user:'S. Kapoor',        action:'Imported',  module:'Age Bands',     details:'All 7 bands updated via CSV import',           type:'Norm'    },
  ]);
  const [versionHistory] = useState([
    { version:'v3.2', date:'Jan 15, 2025', status:'Live',  author:'A. Krishnamurthy', changes:3,  summary:'Band C/E2 norm recalibration + ATT formula weight adjustment' },
    { version:'v3.1', date:'Nov 20, 2024', status:'Live',  author:'A. Krishnamurthy', changes:7,  summary:'MEM encoding weight update + exam preparedness domain weight increase' },
    { version:'v3.0', date:'Aug 12, 2024', status:'Draft', author:'S. Kapoor',        changes:12, summary:'Full norm recalibration across all 7 age bands using updated national sample' },
    { version:'v2.1', date:'Mar 5, 2024',  status:'Draft', author:'Dr. R. Mehta',     changes:5,  summary:'ATT Fatigue flag threshold introduced; LES pattern detection rules added' },
    { version:'v2.0', date:'Jan 10, 2024', status:'Draft', author:'A. Krishnamurthy', changes:19, summary:'Initial structured norm tables. CU module introduced. Domain mapping added.' },
  ]);
  const [auditFilter, setAuditFilter] = useState('All Types');
  const [moduleHealth] = useState<Record<string,{linked:number,lastCalib:string,drift:number,errors:number}>>({
    LES:  { linked:14, lastCalib:'Jan 2025', drift:2.1, errors:0 },
    ATT:  { linked:11, lastCalib:'Jan 2025', drift:4.8, errors:0 },
    MEM:  { linked:9,  lastCalib:'Jan 2025', drift:1.3, errors:0 },
    CU:   { linked:12, lastCalib:'Jan 2025', drift:0.9, errors:0 },
    STR:  { linked:8,  lastCalib:'Nov 2024', drift:6.2, errors:1 },
    EXAM: { linked:17, lastCalib:'Jan 2025', drift:3.0, errors:0 },
  });
  const [domainRows, setDomainRows] = useState<{id:number,domain:string,domainCode:string,subdomain:string,subdomainCode:string,module:string,band:string,weight:number,status:string}[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string|null>(null);
  const [productWeightConfig, setProductWeightConfig] = useState<Array<{domainCode:string,domainName:string,domainWeight:number,subdomains:Array<{code:string,name:string,weight:number}>}>>([]);
  const [domainSaveStatus, setDomainSaveStatus] = useState<'idle'|'saving'|'saved'|'error'>('idle');
  const [normRows, setNormRows] = useState([
    { band:'A',  grades:'Gr 6–7',      ages:'11–13', p20:28, p40:42, p60:58, p80:74, n:1842, se:1.4 },
    { band:'B',  grades:'Gr 8–9',      ages:'13–15', p20:32, p40:46, p60:62, p80:77, n:2210, se:1.2 },
    { band:'C',  grades:'Gr 10',       ages:'15–16', p20:35, p40:50, p60:65, p80:80, n:1975, se:1.3 },
    { band:'D',  grades:'Gr 11–12',    ages:'16–18', p20:38, p40:53, p60:68, p80:82, n:2440, se:1.1 },
    { band:'E1', grades:'UG Yr 1–2',   ages:'18–20', p20:40, p40:55, p60:70, p80:84, n:1320, se:1.6 },
    { band:'E2', grades:'UG Yr 3+/PG', ages:'20–23', p20:42, p40:57, p60:72, p80:86, n: 980, se:1.8 },
    { band:'E3', grades:'Adult',        ages:'23+',   p20:44, p40:59, p60:74, p80:88, n: 640, se:2.1 },
  ] as {band:string,grades:string,ages:string,p20:number,p40:number,p60:number,p80:number,n:number,se:number}[]);
  const [normLocked, setNormLocked]     = useState(false);
  const [batchMode, setBatchMode]       = useState(false);
  const [batchCsv, setBatchCsv]         = useState('');
  const [batchResults, setBatchResults] = useState<{row:number,inputs:string,composite:string,tier:string}[]>([]);
  const [diffExpanded, setDiffExpanded] = useState<string|null>(null);
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState<{band:string,p20:number,p40:number,p60:number,p80:number,n:number,se:number,valid:boolean,error:string}[]>([]);
  const [alertRules, setAlertRules]     = useState([
    { id:1, metric:'Drift %',    condition:'>',  threshold:5,  module:'All',  enabled:true,  notify:'superadmin@metryxone.com' },
    { id:2, metric:'Linked Drop',condition:'>',  threshold:2,  module:'STR',  enabled:true,  notify:'superadmin@metryxone.com' },
    { id:3, metric:'Norm Age',   condition:'>',  threshold:12, module:'All',  enabled:false, notify:'superadmin@metryxone.com' },
  ] as {id:number,metric:string,condition:string,threshold:number,module:string,enabled:boolean,notify:string}[]);
  const [formulaRows, setFormulaRows] = useState([] as {code:string,name:string,formula:string,weights:string,bands:string,params:number,status:string,color:string}[]);
  const [scoringParams, setScoringParams] = useState([] as {id:number,module_code:string,param_key:string,label:string,value:string,editable:boolean}[]);
  const [scoringConfigLoaded, setScoringConfigLoaded] = useState(false);

  // Fetch scoring config from DB
  const loadScoringConfig = async () => {
    try {
      const res = await fetch('/api/admin/scoring/config', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.modules?.length) {
        setFormulaRows(data.modules.map((m: any) => ({
          code: m.code, name: m.name, formula: m.formula, weights: m.weights,
          bands: m.bands, params: (data.params || []).filter((p: any) => p.module_code === m.code).length,
          status: m.status, color: m.color,
        })));
      }
      if (data.domains?.length) {
        setDomainRows(data.domains.map((d: any) => ({
          id: d.id, domain: d.domain, subdomain: d.subdomain,
          module: d.module_code, band: d.age_band_scope,
          weight: d.weight_percent, status: d.status,
        })));
      }
      if (data.norms?.length) {
        setNormRows(data.norms.map((n: any) => ({
          band: n.band, grades: n.grades, ages: n.ages,
          p20: Number(n.p20), p40: Number(n.p40), p60: Number(n.p60), p80: Number(n.p80),
          n: n.sample_size || 0, se: Number(n.standard_error) || 0,
        })));
      }
      if (data.params?.length) {
        setScoringParams(data.params);
      }
      setScoringConfigLoaded(true);
    } catch (err) { console.error('Failed to load scoring config:', err); }
  };
  useEffect(() => { if (isAuthenticated && activeTab === 'scoring' && !scoringConfigLoaded) loadScoringConfig(); }, [isAuthenticated, activeTab, scoringConfigLoaded]);

  // Save scoring config helpers
  const saveScoringModules = async () => {
    try {
      await fetch('/api/admin/scoring/modules', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules: formulaRows }),
      });
      toast({ title: 'Scoring modules saved' });
    } catch { toast({ title: 'Failed to save modules', variant: 'destructive' }); }
  };
  const saveScoringDomains = async () => {
    try {
      await fetch('/api/admin/scoring/domains', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains: domainRows.map(d => ({ domain: d.domain, subdomain: d.subdomain, module_code: d.module, age_band_scope: d.band, weight_percent: d.weight, status: d.status })) }),
      });
      toast({ title: 'Domain config saved' });
    } catch { toast({ title: 'Failed to save domain config', variant: 'destructive' }); }
  };
  const saveScoringNorms = async () => {
    try {
      await fetch('/api/admin/scoring/norms', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ norms: normRows.map(n => ({ band: n.band, grades: n.grades, ages: n.ages, p20: n.p20, p40: n.p40, p60: n.p60, p80: n.p80, sample_size: n.n, standard_error: n.se })) }),
      });
      toast({ title: 'Age band norms saved' });
    } catch { toast({ title: 'Failed to save norms', variant: 'destructive' }); }
  };
  const saveScoringParams = async () => {
    try {
      await fetch('/api/admin/scoring/params', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params: scoringParams }),
      });
      toast({ title: 'Formula parameters saved' });
    } catch { toast({ title: 'Failed to save params', variant: 'destructive' }); }
  };
  const publishScoringConfig = async (version: string, notes: string) => {
    try {
      await Promise.all([saveScoringModules(), saveScoringDomains(), saveScoringNorms(), saveScoringParams()]);
      await fetch('/api/admin/scoring/publish', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version, notes }),
      });
      setConfigApproval('approved');
      toast({ title: 'Scoring config published', description: `Version ${version} is now live.` });
    } catch { toast({ title: 'Failed to publish', variant: 'destructive' }); }
  };

  const { data: subscriptionPackages = [], refetch: refetchSubscriptionPackages } = useQuery<any[]>({
    queryKey: ['/api/admin/subscription-packages'],
    queryFn: async () => {
      const res = await fetch('/api/admin/subscription-packages', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated
  });

  const { data: subscriptionStats = { totalPackages: 0, activePackages: 0, totalSubscriptions: 0, activeSubscriptions: 0, byCategory: {} }, refetch: refetchSubscriptionStats } = useQuery<any>({
    queryKey: ['/api/admin/subscription-packages/stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/subscription-packages/stats', { credentials: 'include' });
      if (!res.ok) return { totalPackages: 0, activePackages: 0, totalSubscriptions: 0, activeSubscriptions: 0, byCategory: {} };
      return res.json();
    },
    enabled: isAuthenticated
  });

  const { data: lbiCatalog = [] } = useQuery<any[]>({
    queryKey: ['/api/admin/lbi-catalog'],
    queryFn: async () => {
      const res = await fetch('/api/admin/lbi-catalog', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  const { data: moduleScoringCatalog } = useQuery<{modules:any[],correlations:any[],ageBands:any[]}>({
    queryKey: ['/api/admin/scoring/modules-catalog'],
    queryFn: async () => {
      const res = await fetch('/api/admin/scoring/modules-catalog', { credentials: 'include' });
      if (!res.ok) return { modules: [], correlations: [], ageBands: [] };
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 10 * 60 * 1000,
  });

  const { data: engineStats } = useQuery<{modules:number,ageBands:number,domains:number,subdomains:number,correlations:number,products:number,productsConfigured:number,percentileTiers:number}>({
    queryKey: ['/api/admin/scoring/engine-stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/scoring/engine-stats', { credentials: 'include' });
      if (!res.ok) return { modules:8, ageBands:6, domains:18, subdomains:81, correlations:44, products:9, productsConfigured:0, percentileTiers:5 };
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  const { data: assessmentProducts, refetch: refetchProducts } = useQuery<{products:any[]}>({
    queryKey: ['/api/admin/scoring/assessment-products'],
    queryFn: async () => {
      const res = await fetch('/api/admin/scoring/assessment-products', { credentials: 'include' });
      if (!res.ok) return { products: [] };
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  // When selectedProductId changes, load or build the productWeightConfig
  useEffect(() => {
    if (!selectedProductId || !assessmentProducts?.products || !moduleScoringCatalog?.modules) return;
    const product = assessmentProducts.products.find((p: any) => p.id === selectedProductId);
    if (!product) return;
    if (product.domainConfig && product.domainConfig.length > 0) {
      setProductWeightConfig(product.domainConfig);
      return;
    }
    const allDomains: Array<{code:string,name:string,subdomains:Array<{code:string,name:string}>}> = [];
    const seen = new Set<string>();
    moduleScoringCatalog.modules.forEach((m: any) => {
      (m.domains || []).filter((d: any) => !d.isAiLayer).forEach((d: any) => {
        if (!seen.has(d.code)) { seen.add(d.code); allDomains.push({ code: d.code, name: d.name, subdomains: d.subdomains || [] }); }
      });
    });
    const n = allDomains.length;
    const dShare = n ? Math.floor(100/n) : 0; const dRem = n ? 100-dShare*n : 0;
    setProductWeightConfig(allDomains.map((d, di) => {
      const sn = d.subdomains.length; const ss = sn ? Math.floor(100/sn) : 0; const sr = sn ? 100-ss*sn : 0;
      return { domainCode: d.code, domainName: d.name, domainWeight: di===n-1 ? dShare+dRem : dShare,
        subdomains: d.subdomains.map((sd: any, si: number) => ({ code: sd.code, name: sd.name, weight: si===sn-1 ? ss+sr : ss })) };
    }));
  }, [selectedProductId, assessmentProducts, moduleScoringCatalog]);

  // Populate domainRows from module catalog — one row per subdomain per domain per module
  useEffect(() => {
    if (!moduleScoringCatalog?.modules?.length || domainRows.length > 0) return;
    const defaultBand = (moduleScoringCatalog.ageBands || [])[0]?.code || 'A';
    const rows: typeof domainRows = [];
    let rowId = 1;
    moduleScoringCatalog.modules.forEach((m: any) => {
      (m.domains || []).filter((d: any) => !d.isAiLayer).forEach((d: any) => {
        (d.subdomains || []).forEach((sd: any) => {
          rows.push({
            id: rowId++,
            module: m.moduleCode,
            domain: d.name,
            domainCode: d.code,
            subdomain: sd.name,
            subdomainCode: sd.code,
            band: defaultBand,
            weight: Number(sd.weight) || 0,
            status: 'Active',
          });
        });
      });
    });
    setDomainRows(rows);
  }, [moduleScoringCatalog]);

  // Auto-populate Assessment step from Module Management catalog when wizard reaches step 2
  // Skip entirely when a module is selected — domain data comes from the module's domain_selections only
  useEffect(() => {
    if (pkgWizardStep === 2 && createPackageDialog && lbiCatalog.length > 0 && (newPackageData.domainConfig || []).length === 0 && !newPackageData.productName) {
      setNewPackageData(prev => ({
        ...prev,
        domainConfig: lbiCatalog.map((domain: any) => ({
          domainCode: domain.code,
          domainName: domain.name,
          subdomains: (domain.subdomains || []).map((sd: any) => ({ code: sd.code, name: sd.name, count: sd.defaultCount })),
        })),
        domainsCovered: lbiCatalog.map((d: any) => d.name),
      }));
    }
  }, [pkgWizardStep, createPackageDialog, lbiCatalog]);

  const { data: adminSubscriptions = [], refetch: refetchAdminSubscriptions } = useQuery<any[]>({
    queryKey: ['/api/admin/student-subscriptions', bookingStatusFilter, bookingSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (bookingStatusFilter !== 'all') params.set('status', bookingStatusFilter);
      if (bookingSearch) params.set('search', bookingSearch);
      const res = await fetch(`/api/admin/student-subscriptions?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch subscriptions');
      return res.json();
    },
    enabled: activeTab === 'pricing',
  });

  // Fetch assessment domains when pricing tab is active
  useQuery({
    queryKey: ['/api/admin/assessment-domains'],
    queryFn: async () => {
      const res = await fetch('/api/admin/assessment-domains', { credentials: 'include' });
      if (!res.ok) return [];
      const data = await res.json();
      setAssessmentDomains(data);
      return data;
    },
    enabled: activeTab === 'pricing',
  });

  const { data: childrenList = [] } = useQuery<any[]>({
    queryKey: ['/api/admin/children-list'],
    queryFn: async () => {
      const res = await fetch('/api/admin/children-list', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch children');
      return res.json();
    },
    enabled: showAssignDialog,
  });

  const { data: assignChildActiveSubs = [] } = useQuery<any[]>({
    queryKey: ['/api/admin/children', assignChildId, 'active-subscriptions'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/children/${assignChildId}/active-subscriptions`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: showAssignDialog && !!assignChildId,
  });

  const { data: jobs = [], refetch: refetchJobs } = useQuery<any[]>({
    queryKey: ['/api/admin/jobs'],
    queryFn: async () => {
      const res = await fetch('/api/admin/jobs', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated
  });

  const { data: mentors = [], refetch: refetchMentors } = useQuery<any[]>({
    queryKey: ['/api/admin/mentors'],
    queryFn: async () => {
      const res = await fetch('/api/admin/mentors', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated
  });

  // Mentor detail queries (only fetch when a mentor is selected)
  const { data: mentorKpis = [] } = useQuery<any[]>({
    queryKey: ['/api/admin/mentors', selectedMentor?.id, 'kpis'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/mentors/${selectedMentor.id}/kpis`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && !!selectedMentor
  });

  const { data: mentorTasks = [], refetch: refetchMentorTasks } = useQuery<any[]>({
    queryKey: ['/api/admin/mentors', selectedMentor?.id, 'tasks'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/mentors/${selectedMentor.id}/tasks`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && !!selectedMentor
  });

  const { data: mentorPayouts = [] } = useQuery<any[]>({
    queryKey: ['/api/admin/mentors', selectedMentor?.id, 'payouts'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/mentors/${selectedMentor.id}/payouts`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && !!selectedMentor
  });

  const { data: mentorViolations = [], refetch: refetchMentorViolations } = useQuery<any[]>({
    queryKey: ['/api/admin/mentors', selectedMentor?.id, 'violations'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/mentors/${selectedMentor.id}/violations`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && !!selectedMentor
  });

  const { data: mentorBookings = [], refetch: refetchMentorBookings } = useQuery<any[]>({
    queryKey: ['/api/admin/mentors', selectedMentor?.id, 'bookings'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/mentors/${selectedMentor.id}/bookings`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && !!selectedMentor
  });

  const { data: mentorReviewsData = { reviews: [], averageRating: null, totalReviews: 0 }, refetch: refetchMentorReviews } = useQuery<any>({
    queryKey: ['/api/admin/mentors', selectedMentor?.id, 'reviews'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/mentors/${selectedMentor.id}/reviews`, { credentials: 'include' });
      if (!res.ok) return { reviews: [], averageRating: null, totalReviews: 0 };
      return res.json();
    },
    enabled: isAuthenticated && !!selectedMentor
  });

  // ── Mentor Onboarding query ──
  const { data: mentorOnboarding, refetch: refetchMentorOnboarding } = useQuery<any>({
    queryKey: ['/api/admin/mentors', selectedMentor?.id, 'onboarding'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/mentors/${selectedMentor.id}/onboarding`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isAuthenticated && !!selectedMentor && mentorProfileSubTab === 'onboarding'
  });

  // ── Mentor Operations queries ──
  const { data: mentorPlatformStats, refetch: refetchMentorPlatformStats } = useQuery<any>({
    queryKey: ['/api/admin/mentors/platform-stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/mentors/platform-stats', { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isAuthenticated && activeTab === 'mentors' && mentorSectionTab === 'operations',
    refetchInterval: 30000,
  });

  const { data: mentorAllSessions = [], refetch: refetchMentorAllSessions } = useQuery<any[]>({
    queryKey: ['/api/admin/mentors/all-sessions'],
    queryFn: async () => {
      const res = await fetch('/api/admin/mentors/all-sessions', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && activeTab === 'mentors' && mentorSectionTab === 'operations',
  });

  const { data: mentorLeaderboard = [], refetch: refetchMentorLeaderboard } = useQuery<any[]>({
    queryKey: ['/api/admin/mentors/leaderboard'],
    queryFn: async () => {
      const res = await fetch('/api/admin/mentors/leaderboard', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && activeTab === 'mentors' && mentorSectionTab === 'operations',
  });

  // ── Parents queries ──
  const { data: parents = [], refetch: refetchParents, isLoading: loadingParents } = useQuery<any[]>({
    queryKey: ['/api/admin/parents'],
    queryFn: async () => {
      const res = await fetch('/api/admin/parents', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && activeTab === 'parents'
  });

  const { data: parentChildren = [], refetch: refetchParentChildren } = useQuery<any[]>({
    queryKey: ['/api/admin/parents', selectedParent?.id, 'children'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/parents/${selectedParent.id}/children`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && !!selectedParent
  });

  const { data: parentBriefings = [], refetch: refetchParentBriefings } = useQuery<any[]>({
    queryKey: ['/api/admin/parents', selectedParent?.id, 'briefings'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/parents/${selectedParent.id}/briefings`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && !!selectedParent
  });

  const { data: parentSubscription = [], refetch: refetchParentSubscription } = useQuery<any[]>({
    queryKey: ['/api/admin/parents', selectedParent?.id, 'subscription'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/parents/${selectedParent.id}/subscription`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && !!selectedParent && parentDetailTab === 'subscription',
  });

  const { data: parentActivity, refetch: refetchParentActivity } = useQuery<any>({
    queryKey: ['/api/admin/parents', selectedParent?.id, 'activity'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/parents/${selectedParent.id}/activity`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isAuthenticated && !!selectedParent && parentDetailTab === 'activity',
  });

  const { data: parentBookings = [], refetch: refetchParentBookings } = useQuery<any[]>({
    queryKey: ['/api/admin/parents', selectedParent?.id, 'bookings'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/parents/${selectedParent.id}/bookings`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && !!selectedParent && parentDetailTab === 'bookings',
  });

  const { data: parentKyc, refetch: refetchParentKyc } = useQuery<any>({
    queryKey: ['/api/admin/parents', selectedParent?.id, 'kyc'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/parents/${selectedParent.id}/kyc`, { credentials: 'include' });
      if (!res.ok) return { kyc: null, status: 'pending' };
      return res.json();
    },
    enabled: isAuthenticated && !!selectedParent && parentDetailTab === 'kyc',
  });

  // ── Students queries ──
  const { data: studentsList = [], refetch: refetchStudents, isLoading: loadingStudents } = useQuery<any[]>({
    queryKey: ['/api/admin/students'],
    queryFn: async () => {
      const res = await fetch('/api/admin/students', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && activeTab === 'students'
  });

  const { data: classRosterRaw = [], refetch: refetchClassRoster, isLoading: loadingClassRoster } = useQuery<any[]>({
    queryKey: ['/api/admin/students/class-roster'],
    queryFn: async () => {
      const res = await fetch('/api/admin/students/class-roster', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && activeTab === 'students' && studentsView === 'class-roster',
  });

  const { data: studentWellness = [], refetch: refetchStudentWellness } = useQuery<any[]>({
    queryKey: ['/api/admin/students', selectedStudent?.id, 'wellness'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/students/${selectedStudent.id}/wellness`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && !!selectedStudent
  });

  const { data: studentLbi = [], refetch: refetchStudentLbi } = useQuery<any[]>({
    queryKey: ['/api/admin/students', selectedStudent?.id, 'lbi'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/students/${selectedStudent.id}/lbi`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && !!selectedStudent
  });

  const { data: studentBookings = [], refetch: refetchStudentBookings } = useQuery<any[]>({
    queryKey: ['/api/admin/students', selectedStudent?.id, 'bookings'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/students/${selectedStudent.id}/bookings`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && !!selectedStudent
  });

  const { data: studentSubscription = [], refetch: refetchStudentSub } = useQuery<any[]>({
    queryKey: ['/api/admin/students', selectedStudent?.id, 'subscription'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/students/${selectedStudent.id}/subscription`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && !!selectedStudent
  });

  // Full detail record — fires whenever a student is selected; provides fields not in the list response
  const { data: selectedStudentDetail = null } = useQuery<any>({
    queryKey: ['/api/admin/students', selectedStudent?.id, 'detail'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/students/${selectedStudent.id}`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isAuthenticated && !!selectedStudent?.id,
  });
  // Merge: list item fields + full detail fields (detail wins for overlapping keys)
  const sd = selectedStudentDetail ? { ...selectedStudent, ...selectedStudentDetail } : selectedStudent;

  // ── Institutions queries ──
  const { data: institutionsList = [], refetch: refetchInstitutions, isLoading: loadingInstitutions } = useQuery<any[]>({
    queryKey: ['/api/admin/institutions', institutionTypeFilter],
    queryFn: async () => {
      const url = institutionTypeFilter === 'all'
        ? '/api/admin/institutions'
        : `/api/admin/institutions?type=${institutionTypeFilter}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && activeTab === 'institutions'
  });

  const { data: instStudentsData, refetch: refetchInstStudents } = useQuery<any>({
    queryKey: ['/api/admin/institutions/students', selectedInstitution?.id],
    queryFn: async () => {
      if (!selectedInstitution?.id) return { students: [], stats: {}, total: 0 };
      const res = await fetch(`/api/admin/institutions/${selectedInstitution.id}/students`, { credentials: 'include' });
      if (!res.ok) return { students: [], stats: {}, total: 0 };
      return res.json();
    },
    enabled: isAuthenticated && !!selectedInstitution?.id && institutionDetailTab === 'students'
  });

  const { data: instMentorsList } = useQuery<any[]>({
    queryKey: ['/api/admin/mentors-list-inst'],
    queryFn: async () => {
      const res = await fetch('/api/admin/mentors', { credentials: 'include' });
      if (!res.ok) return [];
      const d = await res.json();
      return Array.isArray(d) ? d : (d.mentors || []);
    },
    enabled: isAuthenticated
  });

  const { data: instPlansList } = useQuery<any[]>({
    queryKey: ['/api/admin/subscription-packages-inst'],
    queryFn: async () => {
      const res = await fetch('/api/admin/subscription-packages', { credentials: 'include' });
      if (!res.ok) return [];
      const d = await res.json();
      return Array.isArray(d) ? d : (d.packages || []);
    },
    enabled: isAuthenticated
  });

  const { data: applications = [], refetch: refetchApplications } = useQuery<any[]>({
    queryKey: ['/api/hr/applications'],
    queryFn: async () => {
      const res = await fetch('/api/hr/applications', { credentials: 'include' });
      if (!res.ok) return [];
      const data = await res.json();
      // API may return { stats: [], applications: [] } or just an array
      return Array.isArray(data) ? data : (data.applications || data.stats || []);
    },
    enabled: isAuthenticated
  });

  const { data: transactions = [], refetch: refetchTransactions } = useQuery<any[]>({
    queryKey: ['/api/admin/transactions'],
    queryFn: async () => {
      const res = await fetch('/api/admin/transactions?limit=100', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated
  });

  const { data: financialStats = {} } = useQuery<{
    paymentsReceived?: { total: number; count: number };
    paymentsDone?: { total: number; count: number };
    netBalance?: number;
    pendingPayouts?: { total: number; count: number };
  }>({
    queryKey: ['/api/admin/stats/financial'],
    queryFn: async () => {
      const res = await fetch('/api/admin/stats/financial', { credentials: 'include' });
      if (!res.ok) return {};
      return res.json();
    },
    enabled: isAuthenticated
  });

  const { data: institutes = [] } = useQuery<any[]>({
    queryKey: ['/api/admin/institutes'],
    queryFn: async () => {
      const res = await fetch('/api/admin/institutes', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated
  });

  const { data: usersData } = useQuery<any>({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users?limit=100', { credentials: 'include' });
      if (!res.ok) return { users: [], total: 0, page: 1, totalPages: 0, roleCounts: [] };
      return res.json();
    },
    enabled: isAuthenticated
  });
  const users = usersData?.users || [];

  // Fetch legacy user-role students for old Student Management tab (now students_legacy)
  const [studentsPage, setStudentsPage] = useState(1);
  const [studentsRoleFilter, setStudentsRoleFilter] = useState<string>('student');
  const [studentsActiveFilter, setStudentsActiveFilter] = useState<string>('all');
  const { data: studentsData, isLoading: studentsLoading, refetch: refetchStudentsLegacy } = useQuery<any>({
    queryKey: ['/api/admin/users', 'students_legacy', studentSearch, studentsPage, studentsActiveFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('role', 'student');
      params.append('page', String(studentsPage));
      params.append('limit', '25');
      if (studentSearch) params.append('search', studentSearch);
      if (studentsActiveFilter !== 'all') params.append('is_active', studentsActiveFilter);
      const res = await fetch(`/api/admin/users?${params}`, { credentials: 'include' });
      if (!res.ok) return { users: [], total: 0, page: 1, totalPages: 0 };
      return res.json();
    },
    enabled: false
  });
  const studentsLegacyList = studentsData?.users || [];
  const studentsTotalPages = studentsData?.totalPages || 0;

  // User edit dialog state
  const [editUserDialog, setEditUserDialog] = useState<{ open: boolean; user: any }>({ open: false, user: null });
  const [editUserData, setEditUserData] = useState<any>({});

  // User Management tab state
  const [umPage, setUmPage] = useState(1);
  const [umRoleFilter, setUmRoleFilter] = useState('all');
  const [umStatusFilter, setUmStatusFilter] = useState('all');
  const [umSearch, setUmSearch] = useState('');
  const [umResetPwDialog, setUmResetPwDialog] = useState<{ open: boolean; user: any }>({ open: false, user: null });
  const [umNewPassword, setUmNewPassword] = useState('');

  const { data: umData, isLoading: umLoading, refetch: refetchUm } = useQuery<any>({
    queryKey: ['/api/admin/users', 'usermgmt', umSearch, umRoleFilter, umStatusFilter, umPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', String(umPage));
      params.append('limit', '25');
      if (umSearch) params.append('search', umSearch);
      if (umRoleFilter !== 'all') params.append('role', umRoleFilter);
      if (umStatusFilter !== 'all') params.append('is_active', umStatusFilter);
      const res = await fetch(`/api/admin/users?${params}`, { credentials: 'include' });
      if (!res.ok) return { users: [], total: 0, page: 1, totalPages: 0, roleCounts: [] };
      return res.json();
    },
    enabled: isAuthenticated && activeTab === 'usermgmt'
  });
  const umUsers = umData?.users || [];
  const umTotalPages = umData?.totalPages || 0;
  const umTotal = umData?.total || 0;
  const umRoleCounts = umData?.roleCounts || [];

  const { data: onboardingStats } = useQuery({
    queryKey: ['/api/admin/onboarding-stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/onboarding-stats', { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isAuthenticated && (activeTab === 'usermgmt' && userMgmtView === 'onboarding')
  });

  // KYC Documents
  const { data: kycDocuments = [], refetch: refetchKyc } = useQuery<any[]>({
    queryKey: ['/api/admin/kyc', kycStatusFilter],
    queryFn: async () => {
      const params = kycStatusFilter !== 'all' ? `?status=${kycStatusFilter}` : '';
      const res = await fetch(`/api/admin/kyc${params}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && (activeTab === 'usermgmt' && userMgmtView === 'onboarding') && onboardingSubTab === 'kyc'
  });

  // Student Enrollments
  const { data: studentEnrollments = [], refetch: refetchEnrollments } = useQuery<any[]>({
    queryKey: ['/api/admin/student-enrollments', enrollmentStatusFilter],
    queryFn: async () => {
      const params = [];
      if (enrollmentStatusFilter !== 'all') params.push(`paymentStatus=${enrollmentStatusFilter}`);
      const queryString = params.length > 0 ? `?${params.join('&')}` : '';
      const res = await fetch(`/api/admin/student-enrollments${queryString}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && (activeTab === 'usermgmt' && userMgmtView === 'onboarding') && onboardingSubTab === 'enrollments'
  });

  const { data: enrollmentKycList = [], refetch: refetchEnrollmentKyc } = useQuery<any[]>({
    queryKey: ['/api/admin/enrollment-kyc'],
    queryFn: async () => {
      const res = await fetch('/api/admin/enrollment-kyc', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && (activeTab === 'usermgmt' && userMgmtView === 'onboarding') && onboardingSubTab === 'enrollment-kyc'
  });

  const { data: mentorPipelineList = [], refetch: refetchMentorPipeline } = useQuery<any[]>({
    queryKey: ['/api/admin/mentors/onboarding-pipeline'],
    queryFn: async () => {
      const res = await fetch('/api/admin/mentors?status=all&limit=200', { credentials: 'include' });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data.mentors || []);
    },
    enabled: isAuthenticated && (activeTab === 'usermgmt' && userMgmtView === 'onboarding') && onboardingSubTab === 'mentor-pipeline',
  });

  const { data: onboardingHistory = [] } = useQuery<any[]>({
    queryKey: ['/api/admin/onboarding', selectedOnboarding?.id, 'history'],
    queryFn: async () => {
      if (!selectedOnboarding) return [];
      const res = await fetch(`/api/admin/onboarding/${selectedOnboarding.id}/history`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && !!selectedOnboarding
  });

  const { data: kycDocs = [], refetch: refetchKycDocs } = useQuery<any[]>({
    queryKey: ['/api/admin/onboarding', selectedOnboarding?.id, 'kyc-documents'],
    queryFn: async () => {
      if (!selectedOnboarding) return [];
      const res = await fetch(`/api/admin/onboarding/${selectedOnboarding.id}/kyc-documents`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && !!selectedOnboarding
  });

  // Curriculum data for Question Bank
  const { data: boards = [] } = useQuery<any[]>({
    queryKey: ['/api/curriculum/boards'],
    queryFn: async () => {
      const res = await fetch('/api/curriculum/boards', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && activeTab === 'questionbank'
  });

  const { data: classes = [] } = useQuery<any[]>({
    queryKey: ['/api/curriculum/boards', qbBoardFilter, 'classes'],
    queryFn: async () => {
      if (qbBoardFilter === 'all') return [];
      const res = await fetch(`/api/curriculum/boards/${qbBoardFilter}/classes`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && activeTab === 'questionbank' && qbBoardFilter !== 'all'
  });

  const { data: subjects = [] } = useQuery<any[]>({
    queryKey: ['/api/curriculum/classes', qbClassFilter, 'subjects'],
    queryFn: async () => {
      if (qbClassFilter === 'all') return [];
      const res = await fetch(`/api/curriculum/classes/${qbClassFilter}/subjects`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && activeTab === 'questionbank' && qbClassFilter !== 'all'
  });

  const { data: questionBankQuestions = [], refetch: refetchQuestions } = useQuery<any[]>({
    queryKey: ['/api/admin/question-bank', qbBoardFilter, qbClassFilter, qbSubjectFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (qbBoardFilter !== 'all') params.append('boardId', qbBoardFilter);
      if (qbClassFilter !== 'all') params.append('classId', qbClassFilter);
      if (qbSubjectFilter !== 'all') params.append('subjectId', qbSubjectFilter);
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/admin/question-bank${queryString}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && activeTab === 'questionbank'
  });

  // Assessment Blueprints Query
  const { data: blueprints = [], refetch: refetchBlueprints } = useQuery<any[]>({
    queryKey: ['/api/admin/assessment-blueprints'],
    queryFn: async () => {
      const res = await fetch('/api/admin/assessment-blueprints', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && activeTab === 'questionbank' && qbSubTab === 'blueprints'
  });

  const { data: broadcastHistory = [], refetch: refetchBroadcasts } = useQuery<any[]>({
    queryKey: ['/api/admin/notification-broadcasts'],
    queryFn: async () => {
      const res = await fetch('/api/admin/notification-broadcasts', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: activeTab === 'notifications_mgmt',
  });

  const { data: notifTemplates = [], isLoading: notifTemplatesLoading } = useQuery<any[]>({
    queryKey: ['/api/notification-templates'],
    queryFn: async () => {
      const res = await fetch('/api/notification-templates', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && activeTab === 'notifications_mgmt' && (notifSubTab === 'templates' || notifSubTab === 'quicksend'),
  });

  const { data: notifAnalytics, isLoading: notifAnalyticsLoading } = useQuery<any>({
    queryKey: ['/api/admin/notification-analytics'],
    queryFn: async () => {
      const res = await fetch('/api/admin/notification-analytics', { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isAuthenticated && activeTab === 'notifications_mgmt' && notifSubTab === 'analytics',
  });

  const { data: pauseStats, isLoading: pauseStatsLoading } = useQuery<{
    started: number; completed: number;
    trend: { date: string; started: number; completed: number }[];
  }>({
    queryKey: ['/api/pause-analytics/stats', pauseFrom, pauseTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (pauseFrom) params.set('from', pauseFrom);
      if (pauseTo) params.set('to', pauseTo);
      const res = await fetch(`/api/pause-analytics/stats?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) return { started: 0, completed: 0, trend: [] };
      return res.json();
    },
    enabled: isAuthenticated && activeTab === 'overview',
  });

  const { data: notifLogs = [], isLoading: notifLogsLoading } = useQuery<any[]>({
    queryKey: ['/api/admin/notification-logs', notifLogCategoryFilter, notifLogTypeFilter, notifLogPriorityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('limit', '50');
      if (notifLogCategoryFilter !== 'all') params.append('category', notifLogCategoryFilter);
      if (notifLogTypeFilter !== 'all') params.append('type', notifLogTypeFilter);
      if (notifLogPriorityFilter !== 'all') params.append('priority', notifLogPriorityFilter);
      const res = await fetch(`/api/admin/notification-logs?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && activeTab === 'notifications_mgmt' && notifSubTab === 'auditlogs',
  });

  const { data: notifScenarios = [], refetch: refetchScenarios } = useQuery<any[]>({
    queryKey: ['/api/admin/notification-scenarios'],
    queryFn: async () => {
      const res = await fetch('/api/admin/notification-scenarios', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && activeTab === 'notifications_mgmt' && notifSubTab === 'scenarios',
  });

  const [scheduledJobStatusFilter, setScheduledJobStatusFilter] = useState('all');
  const { data: scheduledJobs = [], refetch: refetchScheduledJobs } = useQuery<any[]>({
    queryKey: ['/api/admin/notification-scheduled-jobs', scheduledJobStatusFilter],
    queryFn: async () => {
      const params = scheduledJobStatusFilter !== 'all' ? `?status=${scheduledJobStatusFilter}` : '';
      const res = await fetch(`/api/admin/notification-scheduled-jobs${params}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && activeTab === 'notifications_mgmt' && notifSubTab === 'scheduled',
  });

  // Mutations
  const approveOnboardingMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const res = await fetch(`/api/admin/onboarding/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reviewNotes: notes })
      });
      if (!res.ok) throw new Error('Failed to approve');
      return res.json();
    },
    onSuccess: (data, variables) => {
      toast({ title: 'Success', description: 'Request approved successfully' });
      refetchOnboarding();
      refetchStats();
      refetchMentors();
      setActionDialog({ open: false, type: '', item: null });
      setActionNotes('');
    },
    onError: () => toast({ title: 'Error', description: 'Failed to approve request', variant: 'destructive' })
  });

  // KYC Maker-Checker Mutations
  const makerVerifyKycMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const res = await fetch(`/api/admin/kyc/${id}/maker-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notes })
      });
      if (!res.ok) throw new Error('Failed to verify');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Maker Verified', description: 'KYC document verified by maker, awaiting checker approval' });
      refetchKyc();
      setActionDialog({ open: false, type: '', item: null });
      setActionNotes('');
      if (selectedKyc) setSelectedKyc(data.kyc);
    },
    onError: () => toast({ title: 'Error', description: 'Failed to verify KYC', variant: 'destructive' })
  });

  const checkerApproveKycMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const res = await fetch(`/api/admin/kyc/${id}/checker-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notes })
      });
      if (!res.ok) throw new Error('Checker must be different from maker');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'KYC Approved', description: 'KYC document approved by checker' });
      refetchKyc();
      setActionDialog({ open: false, type: '', item: null });
      setActionNotes('');
      if (selectedKyc) setSelectedKyc(data.kyc);
    },
    onError: () => toast({ title: 'Error', description: 'Checker must be different from maker', variant: 'destructive' })
  });

  const rejectKycMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await fetch(`/api/admin/kyc/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason })
      });
      if (!res.ok) throw new Error('Failed to reject');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'KYC Rejected', description: 'KYC document has been rejected' });
      refetchKyc();
      setActionDialog({ open: false, type: '', item: null });
      setActionNotes('');
      if (selectedKyc) setSelectedKyc(data.kyc);
    },
    onError: () => toast({ title: 'Error', description: 'Failed to reject KYC', variant: 'destructive' })
  });

  const rejectOnboardingMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await fetch(`/api/admin/onboarding/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rejectionReason: reason, reviewNotes: reason })
      });
      if (!res.ok) throw new Error('Failed to reject');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Request rejected' });
      refetchOnboarding();
      setActionDialog({ open: false, type: '', item: null });
      setActionNotes('');
    },
    onError: () => toast({ title: 'Error', description: 'Failed to reject request', variant: 'destructive' })
  });

  const verifyDocumentsMutation = useMutation({
    mutationFn: async ({ id, verified }: { id: string; verified: boolean }) => {
      const res = await fetch(`/api/admin/onboarding/${id}/verify-documents`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ verified })
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Success', description: data.documentsVerified ? 'Documents verified' : 'Documents unmarked' });
      refetchOnboarding();
      if (selectedOnboarding) setSelectedOnboarding(data);
    },
    onError: () => toast({ title: 'Error', description: 'Failed to update documents status', variant: 'destructive' })
  });

  const verifyKycMutation = useMutation({
    mutationFn: async ({ id, verified }: { id: string; verified: boolean }) => {
      const res = await fetch(`/api/admin/onboarding/${id}/verify-kyc`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ verified })
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Success', description: data.kycVerified ? 'KYC verified' : 'KYC unmarked' });
      refetchOnboarding();
      if (selectedOnboarding) setSelectedOnboarding(data);
    },
    onError: () => toast({ title: 'Error', description: 'Failed to update KYC status', variant: 'destructive' })
  });

  const suspendOnboardingMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await fetch(`/api/admin/onboarding/${id}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason, notes: reason })
      });
      if (!res.ok) throw new Error('Failed to suspend');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Entity suspended' });
      refetchOnboarding();
      setActionDialog({ open: false, type: '', item: null });
      setActionNotes('');
    },
    onError: () => toast({ title: 'Error', description: 'Failed to suspend entity', variant: 'destructive' })
  });

  const reinstateOnboardingMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const res = await fetch(`/api/admin/onboarding/${id}/reinstate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notes })
      });
      if (!res.ok) throw new Error('Failed to reinstate');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Entity reinstated' });
      refetchOnboarding();
      setActionDialog({ open: false, type: '', item: null });
      setActionNotes('');
    },
    onError: () => toast({ title: 'Error', description: 'Failed to reinstate entity', variant: 'destructive' })
  });

  const generateCodeMutation = useMutation({
    mutationFn: async ({ entityType, entityId }: { entityType: string; entityId: string }) => {
      const res = await fetch('/api/admin/entity-codes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ entityType, entityId })
      });
      if (!res.ok) throw new Error('Failed to generate code');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Code Generated', description: `New code: ${data.code}` });
      refetchCodes();
      setActionDialog({ open: false, type: '', item: null });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to generate code', variant: 'destructive' })
  });

  const revokeCodeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/entity-codes/${id}/revoke`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to revoke');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Code revoked' });
      refetchCodes();
    },
    onError: () => toast({ title: 'Error', description: 'Failed to revoke code', variant: 'destructive' })
  });

  const activateMentorMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/mentors/${id}/activate`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to activate');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Mentor activated' });
      refetchMentors();
    },
    onError: () => toast({ title: 'Error', description: 'Failed to activate mentor', variant: 'destructive' })
  });

  const suspendMentorMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await fetch(`/api/admin/mentors/${id}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason })
      });
      if (!res.ok) throw new Error('Failed to suspend');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Mentor suspended' });
      refetchMentors();
      setActionDialog({ open: false, type: '', item: null });
      setActionNotes('');
    },
    onError: () => toast({ title: 'Error', description: 'Failed to suspend mentor', variant: 'destructive' })
  });

  const warnMentorMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await fetch(`/api/admin/mentors/${id}/warn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason })
      });
      if (!res.ok) throw new Error('Failed to issue warning');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Warning Issued', description: 'Mentor has been issued a warning' });
      refetchMentors();
      setMentorDialog({ open: false, type: '', mentor: null });
      setMentorDialogData({});
    },
    onError: () => toast({ title: 'Error', description: 'Failed to issue warning', variant: 'destructive' })
  });

  const reactivateMentorMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const res = await fetch(`/api/admin/mentors/${id}/reactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notes })
      });
      if (!res.ok) throw new Error('Failed to reactivate');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Reactivated', description: 'Mentor has been reactivated' });
      refetchMentors();
      setMentorDialog({ open: false, type: '', mentor: null });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to reactivate mentor', variant: 'destructive' })
  });

  const advanceOnboardingStageMutation = useMutation({
    mutationFn: async ({ id, stage, deliveryLink }: { id: string; stage: string; deliveryLink?: string }) => {
      const res = await fetch(`/api/admin/mentors/${id}/onboarding/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stage, deliveryLink })
      });
      if (!res.ok) throw new Error('Failed to advance stage');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Stage Updated', description: `Onboarding advanced to: ${data.stage?.replace(/_/g, ' ')}` });
      refetchMentors();
      refetchMentorOnboarding();
    },
    onError: () => toast({ title: 'Error', description: 'Failed to advance onboarding stage', variant: 'destructive' })
  });

  const assignTaskMutation = useMutation({
    mutationFn: async ({ mentorId, task }: { mentorId: string; task: any }) => {
      const res = await fetch(`/api/admin/mentors/${mentorId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(task)
      });
      if (!res.ok) throw new Error('Failed to assign task');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Task Assigned', description: 'Task has been assigned to mentor' });
      refetchMentorTasks();
      setMentorDialog({ open: false, type: '', mentor: null });
      setMentorDialogData({});
    },
    onError: () => toast({ title: 'Error', description: 'Failed to assign task', variant: 'destructive' })
  });

  const reportViolationMutation = useMutation({
    mutationFn: async ({ mentorId, violation }: { mentorId: string; violation: any }) => {
      const res = await fetch(`/api/admin/mentors/${mentorId}/violations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(violation)
      });
      if (!res.ok) throw new Error('Failed to report violation');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Violation Reported', description: 'Violation has been reported and logged' });
      refetchMentorViolations();
      setMentorDialog({ open: false, type: '', mentor: null });
      setMentorDialogData({});
    },
    onError: () => toast({ title: 'Error', description: 'Failed to report violation', variant: 'destructive' })
  });

  const updatePhiMutation = useMutation({
    mutationFn: async ({ id, phi, notes }: { id: string; phi: number; notes?: string }) => {
      const res = await fetch(`/api/admin/mentors/${id}/phi`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ performanceHealthIndex: phi, notes })
      });
      if (!res.ok) throw new Error('Failed to update PHI');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'PHI Updated', description: 'Performance Health Index has been updated' });
      refetchMentors();
      setMentorDialog({ open: false, type: '', mentor: null });
      setMentorDialogData({});
    },
    onError: () => toast({ title: 'Error', description: 'Failed to update PHI', variant: 'destructive' })
  });

  const approveJobMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/hr/jobs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error('Failed to update job');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Job status updated' });
      refetchJobs();
    },
    onError: () => toast({ title: 'Error', description: 'Failed to update job', variant: 'destructive' })
  });

  // HR Job Workflow Mutations
  const createJobMutation = useMutation({
    mutationFn: async (job: any) => {
      const res = await fetch('/api/hr/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(job)
      });
      if (!res.ok) throw new Error('Failed to create job');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Job posting created' });
      refetchJobs();
      setActionDialog({ open: false, type: '', item: null });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to create job', variant: 'destructive' })
  });

  const submitJobMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/hr/jobs/${id}/submit`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to submit job');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Submitted!', description: 'Job submitted for HR review' });
      refetchJobs();
      if (selectedJob) setSelectedJob(data.job || { ...selectedJob, status: 'hr_review' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to submit job', variant: 'destructive' })
  });

  const approveJobStageMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/hr/jobs/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notes: 'Approved by Super Admin' })
      });
      if (!res.ok) throw new Error('Failed to approve job');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Success', description: 'Job approved and moved to next stage' });
      refetchJobs();
      if (selectedJob) setSelectedJob(data.job || null);
    },
    onError: () => toast({ title: 'Error', description: 'Failed to approve job', variant: 'destructive' })
  });

  const publishJobMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/hr/jobs/${id}/publish`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to publish job');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Published!', description: 'Job is now live on the careers portal' });
      refetchJobs();
      if (selectedJob) setSelectedJob(data.job || null);
    },
    onError: () => toast({ title: 'Error', description: 'Failed to publish job', variant: 'destructive' })
  });

  const closeJobMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/hr/jobs/${id}/close`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to close job');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Position Closed', description: 'Job is no longer accepting applications' });
      refetchJobs();
      if (selectedJob) setSelectedJob(data.job || null);
    },
    onError: () => toast({ title: 'Error', description: 'Failed to close job', variant: 'destructive' })
  });

  const rejectJobMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await fetch(`/api/hr/jobs/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason })
      });
      if (!res.ok) throw new Error('Failed to reject job');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Job Rejected', description: 'The job has been returned to draft status' });
      refetchJobs();
      setActionDialog({ open: false, type: '', item: null });
      setActionNotes('');
      if (selectedJob) setSelectedJob(data.job || { ...selectedJob, status: 'draft' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to reject job', variant: 'destructive' });
      setActionDialog({ open: false, type: '', item: null });
      setActionNotes('');
    }
  });

  // Application Mutations
  const shortlistApplicationMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/hr/applications/${id}/shortlist`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to shortlist');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Shortlisted!', description: 'Candidate moved to shortlist for further review' });
      refetchApplications();
      if (selectedApplication) setSelectedApplication(data.application || { ...selectedApplication, status: 'shortlisted' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to shortlist applicant', variant: 'destructive' })
  });

  const rejectApplicationMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await fetch(`/api/hr/applications/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason })
      });
      if (!res.ok) throw new Error('Failed to reject');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Application Rejected', description: 'The candidate has been notified' });
      refetchApplications();
      setActionDialog({ open: false, type: '', item: null });
      setActionNotes('');
      if (selectedApplication) setSelectedApplication(data.application || { ...selectedApplication, status: 'rejected' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to reject application', variant: 'destructive' })
  });

  const advanceApplicationMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      const res = await fetch(`/api/hr/applications/${id}/${action}`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`Failed to ${action}`);
      return res.json();
    },
    onSuccess: (data, { action }) => {
      const labels: Record<string, string> = {
        'request-payment': 'Payment requested from candidate',
        'start-training': 'Training started for candidate',
        'start-assessment': 'Assessment started for candidate',
        'activate': 'Candidate activated as mentor',
      };
      toast({ title: 'Success', description: labels[action] || 'Status updated' });
      refetchApplications();
      if (data.application) setSelectedApplication(data.application);
    },
    onError: () => toast({ title: 'Error', description: 'Failed to update application status', variant: 'destructive' })
  });

  const processPayoutMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/payouts/${id}/process`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to process payout');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Payout processed' });
      refetchTransactions();
    },
    onError: () => toast({ title: 'Error', description: 'Failed to process payout', variant: 'destructive' })
  });

  const toggleScenarioMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await fetch(`/api/admin/notification-scenarios/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error('Failed to update scenario');
      return res.json();
    },
    onSuccess: () => { refetchScenarios(); toast({ title: 'Scenario updated' }); },
    onError: () => toast({ title: 'Error', description: 'Failed to update scenario', variant: 'destructive' }),
  });

  const deleteScenarioMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/notification-scenarios/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to delete scenario');
      return res.json();
    },
    onSuccess: () => { refetchScenarios(); toast({ title: 'Scenario deleted' }); },
    onError: () => toast({ title: 'Error', description: 'Failed to delete scenario', variant: 'destructive' }),
  });

  const cancelScheduledJobMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/notification-scheduled-jobs/${id}/cancel`, { method: 'PATCH', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to cancel job');
      return res.json();
    },
    onSuccess: () => { refetchScheduledJobs(); toast({ title: 'Scheduled job cancelled' }); },
    onError: () => toast({ title: 'Error', description: 'Failed to cancel', variant: 'destructive' }),
  });

  // Helper functions
  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string }> = {
      pending: { bg: '#FEF3C7', text: '#92400E' },
      approved: { bg: '#D1FAE5', text: '#065F46' },
      rejected: { bg: '#FEE2E2', text: '#991B1B' },
      active: { bg: '#D1FAE5', text: '#065F46' },
      suspended: { bg: '#FEE2E2', text: '#991B1B' },
      warning: { bg: '#FEF3C7', text: '#92400E' },
      completed: { bg: '#D1FAE5', text: '#065F46' },
      processing: { bg: '#DBEAFE', text: '#1E40AF' },
      published: { bg: '#D1FAE5', text: '#065F46' },
      draft: { bg: '#F3F4F6', text: '#374151' },
      granted: { bg: '#D1FAE5', text: '#065F46' },
      revoked: { bg: '#FEE2E2', text: '#991B1B' },
      // HR-specific statuses
      hr_review: { bg: '#FEF3C7', text: '#92400E' },
      legal_review: { bg: '#FED7AA', text: '#9A3412' },
      leadership_approval: { bg: '#E9D5FF', text: '#7C3AED' },
      closed: { bg: '#FEE2E2', text: '#991B1B' },
      applied: { bg: '#DBEAFE', text: '#1E40AF' },
      shortlisted: { bg: '#CCFBF1', text: '#0D9488' },
      payment_pending: { bg: '#FED7AA', text: '#9A3412' },
      training: { bg: '#E0E7FF', text: '#4338CA' },
      pending_training: { bg: '#FEF3C7', text: '#92400E' },
      assessment: { bg: '#FCE7F3', text: '#BE185D' },
      deactivated: { bg: '#F3F4F6', text: '#374151' },
    };
    const c = config[status] || { bg: '#F3F4F6', text: '#374151' };
    return (
      <span 
        className="px-2.5 py-1 rounded-full text-xs font-medium capitalize"
        style={{ backgroundColor: c.bg, color: c.text }}
        data-testid={`badge-status-${status}`}
      >
        {(status || '').replace(/_/g, ' ')}
      </span>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatEntityType = (type?: string): string => {
    if (!type) return '';
    switch (type.toLowerCase()) {
      case 'ngo': return 'NGO';
      case 'lei': return 'LEI';
      default: return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    }
  };

  type NavItem = { id: string; icon: React.ElementType; label: string; external?: boolean; badge?: number; badgeColor?: string };
  // =============================================================================
  // SIDEBAR NAVIGATION — practical IA
  //
  // Ordering principle: daily-use operational groups first, then the intelligence
  // engines, then the ontology / assessment builders, then admin & system, with
  // experimental research tabs collapsed in "Advanced Labs" last.
  //
  // Groups (top → bottom):
  //   Overview · Frameworks · CAPADEX · CAPADEX Intelligence · BIOS & Governance ·
  //   Career Intelligence · Talent Foundation · Talent Intelligence ·
  //   Vision-X Intelligence · Employability & Future Readiness · Learning & Passport ·
  //   Competency Ontology · Assessment Factory · Assessment Config ·
  //   Reporting & Analytics · Users & Orgs · Platform · Operations · System ·
  //   Advanced Labs (collapsed)
  //
  // Invariant: every tab id from the legacy nav is preserved and reachable — this
  // is a pure regroup/reorder, no tab added or removed. menuItems derives from it.
  //
  // Merged tabs:
  //   Security & Audit  → single sidebar entry 'security'; toggled by securityView state
  //   Onboarding        → sub-tab of User Management; toggled by userMgmtView state
  // =============================================================================
  type NavGroup = { label: string | null; items: NavItem[]; isLabs?: boolean };

  // Sidebar menu items — clean IA in priority order:
  //   Overview (always visible) → Frameworks → People & Orgs → Operations →
  //   Reports → Commercial → Governance → Platform → Developer Mode (Labs, last).
  // Every tab id is preserved and reachable (menuItems derives from this list).
  const navGroups: NavGroup[] = [
    // ── Overview (always visible, no header) ────────────────────────────────
    {
      label: null,
      items: [
        { id: 'mission-control',        icon: LayoutDashboard, label: 'Mission Control' },
        { id: 'executive-intelligence', icon: Briefcase,       label: 'Executive Intelligence' },
        { id: 'overview',               icon: PieChart,        label: 'Overview' },
      ]
    },
    // ── Frameworks — every product framework; each opens a tabbed shell whose
    //    own tools live as inner tabs (FrameworkPanel / AdminTabbedShell in
    //    SuperAdminDashboard). One header for many items (not redundant). ──────
    {
      label: 'Frameworks',
      items: [
        { id: 'capadex-fw',           icon: Sparkles,    label: 'CAPADEX Framework' },
        { id: 'competency-fw',        icon: Target,      label: 'Competency Framework' },
        { id: 'assessment-factory-fw', icon: Database,   label: 'Assessment Factory' },
        { id: 'lbi-fw',               icon: Brain,       label: 'LBI Framework' },
        { id: 'employability-fw',     icon: TrendingUp,  label: 'Employability Framework' },
        { id: 'career-builder-fw',    icon: Network,     label: 'Career Builder Framework' },
        { id: 'employer-fw',          icon: Building2,   label: 'Employer & Talent Framework' },
        { id: 'future-readiness-fw',  icon: Zap,         label: 'Future Readiness Framework' },
      ]
    },
    // ── People & Orgs — users, parents, students, institutions, mentors ──────
    {
      label: 'People & Orgs',
      items: [
        { id: 'usermgmt',            icon: Users,         label: 'User Management' },
        { id: 'parents',             icon: UserCircle2,   label: 'Parents' },
        { id: 'students',            icon: GraduationCap, label: 'Students (18+)' },
        { id: 'institutions',        icon: School,        label: 'Institutions' },
        { id: 'hr',                  icon: Briefcase,     label: 'HR & Jobs' },
        { id: 'mentors',             icon: UserCheck,     label: 'Mentors' },
        { id: 'employer-onboarding', icon: Building2,     label: 'Employer Onboarding' },
        { id: 'employer-governance', icon: Gauge,         label: 'Employer Competency Governance' },
      ]
    },
    // ── Operations ──────────────────────────────────────────────────────────
    {
      label: 'Operations',
      items: [
        { id: 'action-center',          icon: ClipboardList,  label: 'Action Center', badge: actionCenterCount, badgeColor: '#344E86' },
        { id: 'notification-center',    icon: Bell,           label: 'Notification Center', badge: notificationCount, badgeColor: '#DC2626' },
        { id: 'health-dashboards',      icon: HeartPulse,     label: 'Health Dashboards' },
        { id: 'approvals',              icon: ClipboardCheck, label: 'Approval Workflow' },
        { id: 'rie-escalations',        icon: AlertTriangle,  label: 'Crisis Escalations', badge: crisisPending, badgeColor: '#DC2626' },
      ]
    },
    // ── Reports ─────────────────────────────────────────────────────────────
    {
      label: 'Reports',
      items: [
        { id: 'reports',              icon: BarChart2, label: 'Unified Reports' },
        { id: 'enterprise-analytics', icon: BarChart3, label: 'Enterprise Analytics' },
        { id: 'report-factory-admin', icon: FileText,  label: 'Report Factory' },
        { id: 'outcome-validation',   icon: Target,    label: 'Outcome Validation' },
      ]
    },
    // ── Commercial ──────────────────────────────────────────────────────────
    {
      label: 'Commercial',
      items: [
        { id: 'pricing',       icon: CreditCard, label: 'Pricing & Packages' },
        { id: 'financials',    icon: Wallet,     label: 'Financials' },
        { id: 'revenue',          icon: TrendingUp, label: 'Revenue Intelligence' },
        { id: 'usage-credits',    icon: Gauge,      label: 'Usage & Credits' },
        { id: 'customer-success', icon: HeartPulse, label: 'Customer Success' },
      ]
    },
    // ── Governance ──────────────────────────────────────────────────────────
    {
      label: 'Governance',
      items: [
        { id: 'enterprise-governance', icon: ShieldCheck, label: 'Enterprise Governance' },
        { id: 'ai-governance',       icon: Shield,      label: 'AI Governance Platform' },
        { id: 'security',            icon: ShieldCheck, label: 'Security & Audit' },
        { id: 'access',              icon: Lock,        label: 'Access Control' },
        { id: 'consents',            icon: ScrollText,  label: 'Consents' },
        { id: 'feature-flags',       icon: ToggleLeft,  label: 'Feature Flags' },
        { id: 'governance-security', icon: ShieldCheck, label: 'Governance & Security' },
        { id: 'ont-governance',      icon: ShieldCheck, label: 'Ontology Governance' },
        { id: 'platform-audit',      icon: ScrollText,  label: 'Platform Audit Log' },
      ]
    },
    // ── Platform ────────────────────────────────────────────────────────────
    {
      label: 'Platform',
      items: [
        { id: 'platform-intelligence',  icon: TrendingUp, label: 'Platform Intelligence' },
        { id: 'multi-tenant-architecture', icon: Building2, label: 'Multi-Tenant Architecture' },
        { id: 'automation-engine',      icon: Zap,       label: 'Automation Engine' },
        { id: 'command-center',         icon: LayoutGrid, label: 'Command Center' },
        { id: 'founder-control-center', icon: LayoutDashboard, label: 'Founder Control Center' },
        { id: 'documents',              icon: FileCheck, label: 'Documents' },
        { id: 'settings',               icon: Settings,  label: 'Settings' },
        { id: 'content',                icon: Play,      label: 'Content Manager' },
        { id: 'reference-intelligence', icon: Database,  label: 'Reference Intelligence' },
        { id: 'codes',                  icon: Hash,      label: 'Entity Codes' },
        { id: 'notifications_mgmt',     icon: Bell,      label: 'Notifications' },
        { id: 'tenants',                icon: Building2, label: 'Multi-Tenant' },
      ]
    },
    // ── Developer Mode — experimental engines & labs (collapsed by default) ──
    {
      label: 'Developer Mode',
      isLabs: true,
      items: [
        // Vision-X
        { id: 'vx-capability-architecture',     icon: Brain,      label: 'VX: Capability Architecture (D2)' },
        { id: 'vx-labor-market-intelligence',   icon: TrendingUp, label: 'VX: Labor Market (D6)' },
        { id: 'vx-evidence-intelligence',       icon: Shield,     label: 'VX: Evidence (D7)' },
        { id: 'vx-tenant-configuration',        icon: Building2,  label: 'VX: Tenant Config (D11)' },
        { id: 'vx-assessment-runtime',          icon: Cpu,        label: 'VX: Assessment Runtime (D18)' },
        { id: 'competency-runtime',             icon: Zap,        label: 'Competency Runtime (P2.3–2.6)' },
        { id: 'competency-ei',                  icon: Activity,   label: 'Employability Intelligence (P3)' },
        { id: 'career-intelligence',            icon: Compass,    label: 'Career Intelligence (P4)' },
        { id: 'ei-profile',                     icon: UserCheck,  label: 'Employability Profile (P3.4–3.5)' },
        { id: 'vx-competency-science-council',  icon: Users2,     label: 'VX: Science Council (D19)' },
        { id: 'vx-workforce-knowledge-graph',   icon: GitBranch,  label: 'VX: Workforce Graph (D1)' },
        { id: 'vx-irt-engine',                  icon: Scale,      label: 'VX: IRT & Adaptive (D9)' },
        { id: 'vx-report-intelligence',         icon: FileText,   label: 'VX: Report Intelligence (D21)' },
        // BIOS Ultimate
        { id: 'cognitive-intelligence', icon: Brain,        label: 'Cognitive Intelligence' },
        { id: 'digital-twin',           icon: Cpu,          label: 'Human Digital Twin' },
        { id: 'psychometrics',          icon: FlaskConical, label: 'Psychometrics Engine' },
        { id: 'semantic-reasoning',     icon: GitBranch,    label: 'Semantic Reasoning' },
        { id: 'memory-architecture',    icon: Archive,      label: 'Memory Architecture' },
        { id: 'ethics-governance',      icon: ShieldCheck,  label: 'Ethics & Governance' },
        { id: 'fairness-engine',        icon: Scale,        label: 'Fairness & Bias' },
        // SPE — Psychometric Engine
        { id: 'spe-scoring',            icon: Calculator,   label: 'SPE: Scoring Engine' },
        { id: 'spe-psychometrics',      icon: FlaskConical, label: 'SPE: IRT & Calibration' },
        { id: 'spe-longitudinal',       icon: TrendingUp,   label: 'SPE: Longitudinal' },
        { id: 'spe-governance',         icon: ShieldCheck,  label: 'SPE: Governance' },
        // BIOS Frontier
        { id: 'bios-frontier',          icon: Brain,        label: 'BIOS: Neuro-Symbolic' },
        { id: 'bios-fusion',            icon: Layers,       label: 'BIOS: Fusion & Meta-Learning' },
        { id: 'bios-agents',            icon: Bot,          label: 'BIOS: Agents & Population' },
        { id: 'bios-simulation',        icon: FlaskConical, label: 'BIOS: Simulation' },
        // ROIE
        { id: 'roie-risk',              icon: AlertTriangle, label: 'ROIE: Risk Engine' },
        { id: 'roie-opportunity',       icon: TrendingUp,    label: 'ROIE: Opportunities' },
        { id: 'roie-semantic',          icon: Network,       label: 'ROIE: Semantic & Population' },
        { id: 'roie-governance',        icon: Shield,        label: 'ROIE: Governance' },
        // PAIE
        { id: 'paie-forecasting',       icon: TrendingUp,   label: 'PAIE: Forecasting' },
        { id: 'paie-opportunity',       icon: Sparkles,     label: 'PAIE: Opportunities' },
        { id: 'paie-intelligence',      icon: Network,      label: 'PAIE: Intelligence' },
        { id: 'paie-governance',        icon: ShieldCheck,  label: 'PAIE: Governance' },
        // LDE
        { id: 'lde-graph',              icon: Network,      label: 'LDE: Knowledge Graph' },
        { id: 'lde-temporal',          icon: TrendingUp,   label: 'LDE: Temporal' },
        { id: 'lde-evolution',         icon: Sparkles,     label: 'LDE: Evolution' },
        { id: 'lde-intelligence',      icon: Network,      label: 'LDE: Intelligence' },
        { id: 'lde-governance',        icon: ShieldCheck,  label: 'LDE: Governance' },
        // RIE
        { id: 'rie-dashboard',         icon: Activity,      label: 'RIE: Dashboard' },
        { id: 'rie-recommendations',   icon: Brain,         label: 'RIE: Recommendations' },
        { id: 'rie-interventions',     icon: Target,        label: 'RIE: Interventions' },
        { id: 'rie-recovery',          icon: TrendingUp,    label: 'RIE: Recovery Profiles' },
        { id: 'rie-opportunity',       icon: Sparkles,      label: 'RIE: Opportunities' },
        { id: 'rie-counsellors',       icon: Users,         label: 'RIE: Counsellor Directory' },
      ]
    },
  ]
    .map(group =>
      simHarnessEnabled
        ? group
        : { ...group, items: group.items.filter(it => it.id !== 'simulation-validation') }
    )
    .map(group =>
      governanceEnabled
        ? group
        : { ...group, items: group.items.filter(it => it.id !== 'governance-security') }
    )
    .map(group =>
      revenueIntelEnabled
        ? group
        : { ...group, items: group.items.filter(it => it.id !== 'revenue') }
    )
    .map(group =>
      customerSuccessEnabled
        ? group
        : { ...group, items: group.items.filter(it => it.id !== 'customer-success') }
    )
    .map(group =>
      outcomeValidationEnabled
        ? group
        : { ...group, items: group.items.filter(it => it.id !== 'outcome-validation') }
    )
    .map(group =>
      enterpriseGovernanceEnabled
        ? group
        : { ...group, items: group.items.filter(it => it.id !== 'enterprise-governance') }
    )
    .map(group =>
      platformIntelligenceEnabled
        ? group
        : { ...group, items: group.items.filter(it => it.id !== 'platform-intelligence') }
    )
    .map(group =>
      tenantArchitectureEnabled
        ? group
        : { ...group, items: group.items.filter(it => it.id !== 'multi-tenant-architecture') }
    )
    .map(group =>
      automationEngineEnabled
        ? group
        : { ...group, items: group.items.filter(it => it.id !== 'automation-engine') }
    )
    .map(group =>
      commandCenterEnabled
        ? group
        : { ...group, items: group.items.filter(it => it.id !== 'command-center') }
    )
    .map(group =>
      founderControlCenterEnabled
        ? group
        : { ...group, items: group.items.filter(it => it.id !== 'founder-control-center') }
    )
    .map(group =>
      competencyRuntimeEnabled
        ? group
        : { ...group, items: group.items.filter(it => it.id !== 'competency-runtime') }
    )
    .map(group =>
      competencyEiEnabled
        ? group
        : { ...group, items: group.items.filter(it => it.id !== 'competency-ei') }
    )
    .map(group =>
      competencyEiEnabled
        ? group
        : { ...group, items: group.items.filter(it => it.id !== 'ei-profile') }
    )
    .map(group =>
      careerIntelligenceEnabled
        ? group
        : { ...group, items: group.items.filter(it => it.id !== 'career-intelligence') }
    )
    .map(group =>
      usageMeteringEnabled
        ? group
        : { ...group, items: group.items.filter(it => it.id !== 'usage-credits') }
    )
    .filter(group => group.items.length > 0);
  const menuItems = navGroups.flatMap(g => g.items);

  // If the active tab is no longer reachable (e.g. the Simulation flag turned off
  // while its panel was open), fall back to Overview so the content pane is never blank.
  useEffect(() => {
    if (menuItems.length > 0 && !menuItems.some(it => it.id === activeTab)) {
      setActiveTab('overview');
    }
  }, [activeTab, menuItems]);



  const _ctxValue: AdminDashboardContextValue = {
    isAuthenticated, setIsAuthenticated, isCheckingAuth, activeTab, setActiveTab, crisisPending, psyActiveSection, setPsyActiveSection,
    pauseStats, pauseStatsLoading,
    searchQuery, setSearchQuery, statusFilter, setStatusFilter, entityTypeFilter, setEntityTypeFilter,
    actionDialog, setActionDialog, actionNotes, setActionNotes, sidebarCollapsed, setSidebarCollapsed,
    userMgmtView, setUserMgmtView, securityView, setSecurityView, hrSubTab, setHrSubTab,
    newJobData, setNewJobData, selectedStudents, setSelectedStudents, instituteFilter, setInstituteFilter,
    financialSubTab, setFinancialSubTab, selectedMentor, setSelectedMentor,
    mentorStatusFilter, setMentorStatusFilter, mentorSearchQuery, setMentorSearchQuery,
    mentorTypeFilter, setMentorTypeFilter, mentorAreaFilter, setMentorAreaFilter,
    mentorDialog, setMentorDialog, documentRequestDialog, setDocumentRequestDialog,
    requestedDocs, setRequestedDocs, documentRequestMessage, setDocumentRequestMessage,
    sendingDocRequest, setSendingDocRequest, generatedUploadUrl, setGeneratedUploadUrl,
    mentorDialogData, setMentorDialogData, mentorDetailTab, setMentorDetailTab,
    mentorSectionTab, setMentorSectionTab, mentorViewMode, setMentorViewMode,
    mentorSortBy, setMentorSortBy, mentorSelectedIds, setMentorSelectedIds,
    mentorBulkActionLoading, setMentorBulkActionLoading, inviteMentorModal, setInviteMentorModal,
    inviteForm, setInviteForm, inviting, setInviting, mentorNotifyModal, setMentorNotifyModal,
    mentorNotifySubject, setMentorNotifySubject, mentorNotifyMessage, setMentorNotifyMessage,
    sendingMentorNotify, setSendingMentorNotify, mentorAdjPhiModal, setMentorAdjPhiModal,
    mentorPhiValue, setMentorPhiValue, savingMentorPhi, setSavingMentorPhi,
    mentorAssignTaskModal, setMentorAssignTaskModal, mentorTaskForm, setMentorTaskForm,
    savingMentorTask, setSavingMentorTask, mentorReportViolationModal, setMentorReportViolationModal,
    mentorViolationForm, setMentorViolationForm, savingMentorViolation, setSavingMentorViolation,
    mentorProfileSubTab, setMentorProfileSubTab, mentorProfileModal, setMentorProfileModal,
    mentorProfileForm, setMentorProfileForm, savingMentorProfile, setSavingMentorProfile,
    selectedParent, setSelectedParent, parentSearch, setParentSearch,
    parentSubFilter, setParentSubFilter, parentDetailTab, setParentDetailTab,
    kycAdminAction, setKycAdminAction, kycRejectionReason, setKycRejectionReason,
    kycAdminNotes, setKycAdminNotes, kycActionLoading, setKycActionLoading,
    kycActionFeedback, setKycActionFeedback, consentEmailSending, setConsentEmailSending,
    consentEmailResult, setConsentEmailResult, parentActionLoading, setParentActionLoading,
    parentActionFeedback, setParentActionFeedback, parentResetPwdOpen, setParentResetPwdOpen,
    parentResetPwdValue, setParentResetPwdValue, parentNotifOpen, setParentNotifOpen,
    parentNotifMessage, setParentNotifMessage, selectedStudent, setSelectedStudent,
    studentSearch, setStudentSearch, studentGradeFilter, setStudentGradeFilter,
    studentDetailTab, setStudentDetailTab, studentActionFeedback, setStudentActionFeedback,
    studentActionLoading, setStudentActionLoading, studentResetPwdOpen, setStudentResetPwdOpen,
    studentResetPwdValue, setStudentResetPwdValue, studentNotifOpen, setStudentNotifOpen,
    studentNotifMessage, setStudentNotifMessage, studentRegistryExportOpen, setStudentRegistryExportOpen,
    studentsView, setStudentsView, rosterSchoolFilter, setRosterSchoolFilter,
    rosterGradeFilter, setRosterGradeFilter, rosterSearch, setRosterSearch,
    rosterGroupBy, setRosterGroupBy, rosterExportOpen, setRosterExportOpen,
    selectedInstitution, setSelectedInstitution, institutionSearch, setInstitutionSearch,
    institutionTypeFilter, setInstitutionTypeFilter, institutionDetailTab, setInstitutionDetailTab,
    assigningInstCode, setAssigningInstCode, instStudentsSearch, setInstStudentsSearch,
    instStudentsGroupBy, setInstStudentsGroupBy, instAssignPlanModal, setInstAssignPlanModal,
    instAssignMentorModal, setInstAssignMentorModal, instSelectedPlanId, setInstSelectedPlanId,
    instSelectedMentorId, setInstSelectedMentorId, instMentorSlotDate, setInstMentorSlotDate,
    selectedOnboarding, setSelectedOnboarding, onboardingSearch, setOnboardingSearch,
    onboardingSubTab, setOnboardingSubTab, selectedEnrollmentKyc, setSelectedEnrollmentKyc,
    enrollmentKycSearchQuery, setEnrollmentKycSearchQuery, kycStatusFilter, setKycStatusFilter,
    broadcastCategory, setBroadcastCategory, broadcastTitle, setBroadcastTitle,
    broadcastMessage, setBroadcastMessage, broadcastPriority, setBroadcastPriority,
    broadcastTargetRoles, setBroadcastTargetRoles, broadcastActionUrl, setBroadcastActionUrl,
    broadcastSendEmail, setBroadcastSendEmail, notifSubTab, setNotifSubTab,
    pauseFrom, setPauseFrom, pauseTo, setPauseTo, templateSearch, setTemplateSearch,
    templateCategoryFilter, setTemplateCategoryFilter, templateExpandedId, setTemplateExpandedId,
    templateDialog, setTemplateDialog, templateFormData, setTemplateFormData,
    templateSaving, setTemplateSaving, quickSendTemplateId, setQuickSendTemplateId,
    quickSendRecipientId, setQuickSendRecipientId, quickSendContext, setQuickSendContext,
    quickSendSending, setQuickSendSending, notifLogCategoryFilter, setNotifLogCategoryFilter,
    notifLogTypeFilter, setNotifLogTypeFilter, notifLogPriorityFilter, setNotifLogPriorityFilter,
    notifLogExpandedId, setNotifLogExpandedId, reportIncidentDialog, setReportIncidentDialog,
    newIncidentData, setNewIncidentData, editPackageDialog, setEditPackageDialog,
    createPackageDialog, setCreatePackageDialog, pkgWizardStep, setPkgWizardStep,
    editPackageData, setEditPackageData, deleteConfirmId, setDeleteConfirmId,
    newPackageData, setNewPackageData, newPkgCatMode, setNewPkgCatMode,
    editPkgCatMode, setEditPkgCatMode, newPkgSubCatMode, setNewPkgSubCatMode,
    editPkgSubCatMode, setEditPkgSubCatMode, psychoQuestionFilter, setPsychoQuestionFilter,
    lbiQuestionFilter, setLbiQuestionFilter, bookingSearch, setBookingSearch,
    bookingStatusFilter, setBookingStatusFilter, showAssignDialog, setShowAssignDialog,
    assignChildId, setAssignChildId, assignPackageId, setAssignPackageId,
    assignAgeBandFilter, setAssignAgeBandFilter, assignSubTypeFilter, setAssignSubTypeFilter,
    assignInstitutionFilter, setAssignInstitutionFilter, assignStartDate, setAssignStartDate,
    assignNotes, setAssignNotes, assignSubmitting, setAssignSubmitting,
    assignSuccess, setAssignSuccess, assignConflict, setAssignConflict,
    assignPkgSearch, setAssignPkgSearch, assignMode, setAssignMode,
    assignChildSearch, setAssignChildSearch, assignPkgSort, setAssignPkgSort,
    seedingPackages, setSeedingPackages, seedingEducation, setSeedingEducation, scoringSubTab, setScoringSubTab,
    calcModule, setCalcModule, calcInputs, setCalcInputs, calcResult, setCalcResult,
    expandedModule, setExpandedModule, publishModalOpen, setPublishModalOpen,
    publishChoice, setPublishChoice, publishStatus, setPublishStatus,
    configVersion, configApproval, setConfigApproval, auditLog, setAuditLog,
    versionHistory, auditFilter, setAuditFilter, moduleHealth,
    domainRows, setDomainRows, selectedProductId, setSelectedProductId,
    productWeightConfig, setProductWeightConfig, domainSaveStatus, setDomainSaveStatus,
    normRows, setNormRows, normLocked, setNormLocked, batchMode, setBatchMode,
    batchCsv, setBatchCsv, batchResults, setBatchResults, diffExpanded, setDiffExpanded,
    importPreviewOpen, setImportPreviewOpen, importPreviewData, setImportPreviewData,
    alertRules, setAlertRules, formulaRows, setFormulaRows, scoringParams, setScoringParams,
    scoringConfigLoaded, setScoringConfigLoaded, studentsPage, setStudentsPage,
    studentsRoleFilter, setStudentsRoleFilter, studentsActiveFilter, setStudentsActiveFilter,
    editUserDialog, setEditUserDialog, editUserData, setEditUserData,
    umPage, setUmPage, umRoleFilter, setUmRoleFilter, umStatusFilter, setUmStatusFilter,
    umSearch, setUmSearch, umResetPwDialog, setUmResetPwDialog, umNewPassword, setUmNewPassword,
    scheduledJobStatusFilter, setScheduledJobStatusFilter,
    documentSearch, setDocumentSearch, documentStatusFilter, setDocumentStatusFilter,
    documentEntityFilter, setDocumentEntityFilter, settingsSubTab, setSettingsSubTab,
    stats, statsLoading, refetchStats, platformSettingsData, refetchSettings,
    onboardingApprovals, refetchOnboarding, entityCodes, refetchCodes,
    consents, refetchConsents, documentsData, documentsLoading, refetchDocuments,
    auditLogs, refetchAuditLogs, securityConfig, refetchSecurityConfig,
    securityIncidents, refetchSecurityIncidents, retentionPolicies, refetchRetentionPolicies,
    accessPolicies, refetchAccessPolicies, reconciliations, refetchReconciliations,
    learningPlans, refetchLearningPlans, behaviorData, refetchBehaviorData,
    psychoAgeBands, refetchAgeBands, psychoDomains, refetchDomains,
    psychoConfigs, refetchConfigs, psychoQuestions, refetchPsychoQuestions,
    lbiDomains, refetchLbiDomains, competencyDomains, refetchCompetencyDomains,
    lbiAgeBands, refetchLbiAgeBands, lbiQuestions, refetchLbiQuestions,
    lbiAdminQuestions, refetchLbiAdminQ, lbiAdminQLoading, customAssessmentModules, refetchCustomModules,
    lbiAdminSubdomains, refetchLbiSubdomains, sdiDomains, lbiAdminStats, refetchLbiStats,
    erqData, refetchErqData, examReadyData, refetchExamReadyData,
    subscriptionPackages, refetchSubscriptionPackages, subscriptionStats, refetchSubscriptionStats,
    lbiCatalog, moduleScoringCatalog, engineStats, assessmentProducts, refetchProducts,
    adminSubscriptions, refetchAdminSubscriptions, childrenList, assignChildActiveSubs,
    jobs, refetchJobs, mentors, refetchMentors, mentorKpis, mentorTasks, refetchMentorTasks,
    mentorPayouts, mentorViolations, refetchMentorViolations, mentorBookings, refetchMentorBookings,
    mentorReviewsData, refetchMentorReviews, mentorOnboarding, refetchMentorOnboarding,
    mentorPlatformStats, refetchMentorPlatformStats, mentorAllSessions, refetchMentorAllSessions,
    mentorLeaderboard, refetchMentorLeaderboard, parents, refetchParents, loadingParents,
    parentChildren, refetchParentChildren, parentBriefings, refetchParentBriefings,
    parentSubscription, refetchParentSubscription, parentActivity, refetchParentActivity,
    parentBookings, refetchParentBookings, parentKyc, refetchParentKyc,
    studentsList, refetchStudents, loadingStudents, classRosterRaw, refetchClassRoster, loadingClassRoster,
    studentWellness, refetchStudentWellness, studentLbi, refetchStudentLbi,
    studentBookings, refetchStudentBookings, studentSubscription, refetchStudentSub,
    selectedStudentDetail, institutionsList, refetchInstitutions, loadingInstitutions,
    instStudentsData, refetchInstStudents, instMentorsList, instPlansList,
    applications, refetchApplications, transactions, refetchTransactions, financialStats,
    institutes, usersData, studentsData, studentsLoading, refetchStudentsLegacy,
    umData, umLoading, refetchUm, onboardingStats, kycDocuments, refetchKyc,
    studentEnrollments, refetchEnrollments, enrollmentKycList, refetchEnrollmentKyc,
    mentorPipelineList, refetchMentorPipeline,
    approveOnboardingMutation, makerVerifyKycMutation, checkerApproveKycMutation,
    rejectKycMutation, rejectOnboardingMutation, verifyDocumentsMutation, verifyKycMutation,
    suspendOnboardingMutation, reinstateOnboardingMutation, generateCodeMutation, revokeCodeMutation,
    activateMentorMutation, suspendMentorMutation, warnMentorMutation, reactivateMentorMutation,
    advanceOnboardingStageMutation, assignTaskMutation, reportViolationMutation, updatePhiMutation,
    approveJobMutation, createJobMutation, submitJobMutation, approveJobStageMutation,
    publishJobMutation, closeJobMutation, rejectJobMutation, shortlistApplicationMutation,
    rejectApplicationMutation, advanceApplicationMutation, processPayoutMutation,
    toggleScenarioMutation, deleteScenarioMutation, cancelScheduledJobMutation,
    domainDialog, setDomainDialog, domainDeleteId, setDomainDeleteId, selectedDomainCode, setSelectedDomainCode,
    domainFormData, setDomainFormData, domainSaving, setDomainSaving, domainDeleting, setDomainDeleting,
    compDomainDialog, setCompDomainDialog, compDomainDeleteId, setCompDomainDeleteId,
    compDomainFormData, setCompDomainFormData, compDomainSaving, setCompDomainSaving, compDomainDeleting, setCompDomainDeleting,
    lbiQFormData, setLbiQFormData, lbiQSaving, setLbiQSaving,
    lbiQDialog, setLbiQDialog,
    behaviorUploadDialog, setBehaviorUploadDialog,
    examUploadDialog, setExamUploadDialog,
    curriculumImportDialog, setCurriculumImportDialog,
    aiGenerateDialog, setAiGenerateDialog,
    aiGenerating, setAiGenerating,
    aiGenerateForm, setAiGenerateForm,
    examQuestionsDialog, setExamQuestionsDialog,
    psychoQuestionsDialog, setPsychoQuestionsDialog,
    lbiQuestionsDialog, setLbiQuestionsDialog,
    qbUploadDialog, setQbUploadDialog,
    blueprintDialog, setBlueprintDialog,
    qbSubTab, setQbSubTab,
    qbBoardFilter, setQbBoardFilter,
    qbClassFilter, setQbClassFilter,
    qbSubjectFilter, setQbSubjectFilter,
    blueprintData, setBlueprintData,
    generatingPaper, setGeneratingPaper,
    generatedPaper, setGeneratedPaper,
    questionBankQuestions, refetchQuestions,
    navGroups, menuItems, labsOpen, setLabsOpen,
    importDialog, setImportDialog, importFile, setImportFile, importLoading, setImportLoading, importResult, setImportResult,
    toast, queryClient, saveScoringDomains, saveScoringNorms, saveScoringParams, saveScoringModules,
    updateSetting, seedDefaultSettings, handleLogout, getSettingValue, getSettingBool,
    BRAND, formatDate, formatDateTime, formatCurrency, getStatusBadge, formatEntityType,
  };

  return _ctxValue;
}
