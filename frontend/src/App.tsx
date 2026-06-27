import { useState, useEffect, useRef, lazy, Suspense, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './contexts/AuthContext';
import { LandingPage } from './components/LandingPage';
import { Login } from './components/Login';
import { Registration } from './components/Registration';
import { SiteMap } from './components/SiteMap';
import { ForgotPassword } from './components/ForgotPassword';
import { RoleSelection } from './components/RoleSelection';
import { GlobalSearch } from './components/GlobalSearch';
import type { SearchRole } from './lib/searchIndex';

const GenerateExam = lazy(() => import('./components/GenerateExam').then(m => ({ default: m.GenerateExam })));
const PreviewBlueprint = lazy(() => import('./components/PreviewBlueprint').then(m => ({ default: m.PreviewBlueprint })));
const StudentExamList = lazy(() => import('./components/StudentExamList').then(m => ({ default: m.StudentExamList })));
const ExamPlayer = lazy(() => import('./components/ExamPlayer').then(m => ({ default: m.ExamPlayer })));
const ResultsSummary = lazy(() => import('./components/ResultsSummary').then(m => ({ default: m.ResultsSummary })));
const EnrollmentRequests = lazy(() => import('./components/EnrollmentRequests').then(m => ({ default: m.EnrollmentRequests })));
const ExamTemplates = lazy(() => import('./components/ExamTemplates').then(m => ({ default: m.ExamTemplates })));
const ThemeSettings = lazy(() => import('./components/ThemeSettings').then(m => ({ default: m.ThemeSettings })));

const StudentConsentExplainer = lazy(() => import('./components/behavioral/StudentConsentExplainer').then(m => ({ default: m.StudentConsentExplainer })));
const AssessmentStart = lazy(() => import('./components/behavioral/AssessmentStart').then(m => ({ default: m.AssessmentStart })));
const InteractiveTask = lazy(() => import('./components/behavioral/InteractiveTask').then(m => ({ default: m.InteractiveTask })));
const ContextTransition = lazy(() => import('./components/behavioral/ContextTransition').then(m => ({ default: m.ContextTransition })));
const FocusTask = lazy(() => import('./components/behavioral/FocusTask').then(m => ({ default: m.FocusTask })));
const ReflectionScreen = lazy(() => import('./components/behavioral/ReflectionScreen').then(m => ({ default: m.ReflectionScreen })));
const SessionRecorded = lazy(() => import('./components/behavioral/SessionRecorded').then(m => ({ default: m.SessionRecorded })));
const LbiAssessmentPlayer = lazy(() => import('./components/LbiAssessmentPlayer').then(m => ({ default: m.LbiAssessmentPlayer })));

const UnifiedParentDashboard = lazy(() => import('./components/UnifiedParentDashboard').then(m => ({ default: m.UnifiedParentDashboard })));
const UnifiedInstituteDashboard = lazy(() => import('./components/UnifiedInstituteDashboard').then(m => ({ default: m.UnifiedInstituteDashboard })));
const ParentLbiScreen = lazy(() => import('./components/ParentLbiScreen').then(m => ({ default: m.ParentLbiScreen })));
const StudentDashboard = lazy(() => import('./components/StudentDashboard').then(m => ({ default: m.StudentDashboard })));

const ExamReadyLanding = lazy(() => import('./components/exam-ready').then(m => ({ default: m.LandingPage })));
const ExamReadyCompare = lazy(() => import('./components/exam-ready').then(m => ({ default: m.ComparePage })));
const ExamReadyLogin = lazy(() => import('./components/exam-ready').then(m => ({ default: m.LoginPage })));
const ExamReadyCheckout = lazy(() => import('./components/exam-ready').then(m => ({ default: m.CheckoutPage })));
const ExamReadyAssessmentStart = lazy(() => import('./components/exam-ready').then(m => ({ default: m.AssessmentStartPage })));
const ExamReadyAssessmentStartAll = lazy(() => import('./components/exam-ready').then(m => ({ default: m.AssessmentStartAllPage })));
const ExamReadyAssessment = lazy(() => import('./components/exam-ready').then(m => ({ default: m.AssessmentPage })));
const ExamReadyReportStatus = lazy(() => import('./components/exam-ready').then(m => ({ default: m.ReportStatusPage })));
const ExamReadyReportView = lazy(() => import('./components/exam-ready').then(m => ({ default: m.ReportViewPage })));
const ExamReadyDisclaimer = lazy(() => import('./components/exam-ready').then(m => ({ default: m.DisclaimerPage })));

import { AIDemoWidget } from './components/AIDemoWidget';
import { ChatWidget } from './components/ChatWidget';

// Wrapper that pre-seeds the chat-dismissed flag before ChatWidget reads it,
// so the widget mounts CLOSED on non-landing screens. The widget still
// responds to 'mx-open-chat' events — those handlers clear the flag and open.
function GlobalChatMount() {
  if (typeof window !== 'undefined' && sessionStorage.getItem('mx-chat-dismissed') == null) {
    sessionStorage.setItem('mx-chat-dismissed', '1');
  }
  return <ChatWidget />;
}
// Screens that ship their OWN dedicated bottom-right corner bot (the exam-ready
// BotWidget). The global ChatWidget renders later in the DOM at the same
// corner/z-index, so mounting it here would bury the page's own bot. Suppress
// the global ChatWidget on these screens (no double launcher). NOTE: only the
// four exam-ready screens below actually mount a fixed corner bot — the
// metryxai-assistant screen renders inline assistant content with NO floating
// launcher, so it must KEEP the global ChatWidget.
const SCREENS_WITH_OWN_BOT = new Set<string>([
  'exam-ready',
  'exam-ready-compare',
  'exam-ready-checkout',
  'exam-ready-report-view',
]);
const FreeAssessmentModalGlobal = lazy(() => import('./components/FreeAssessmentModal').then(m => ({ default: m.FreeAssessmentModal })));
const PrivacyPage = lazy(() => import('./components/PrivacyPage').then(m => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('./components/TermsPage').then(m => ({ default: m.TermsPage })));
const SupportPage = lazy(() => import('./components/SupportPage').then(m => ({ default: m.SupportPage })));
const RequestDemo = lazy(() => import('./components/RequestDemo').then(m => ({ default: m.RequestDemo })));
const NGODashboard = lazy(() => import('./components/NGODashboard').then(m => ({ default: m.NGODashboard })));
const HRDashboard = lazy(() => import('./components/HRDashboard'));
const CareersPage = lazy(() => import('./components/CareersPage'));
const SuperAdminDashboard = lazy(() => import('./components/SuperAdminDashboard'));
const AdminPricingPage = lazy(() => import('./pages/AdminPricingPage'));
const CompetencyAdminPage = lazy(() => import('./pages/CompetencyAdminPage'));
const OntologyExplorerPage = lazy(() => import('./pages/OntologyExplorerPage'));
const BenchmarkDashboardPage = lazy(() => import('./pages/BenchmarkDashboardPage'));
const CareerMobilityPage = lazy(() => import('./pages/CareerMobilityPage'));
const TrajectoryDashboardPage = lazy(() => import('./pages/TrajectoryDashboardPage'));
const AdaptiveCausalPage = lazy(() => import('./pages/AdaptiveCausalPage'));
const WorkforceInsightsPage = lazy(() => import('./pages/WorkforceInsightsPage'));
const EnterpriseIntelligencePage = lazy(() => import('./pages/EnterpriseIntelligencePage'));
const EmployerDashboardPage = lazy(() => import('./pages/EmployerDashboardPage'));
const GovernanceConsolePage = lazy(() => import('./pages/GovernanceConsolePage'));
const WorkforceOSPage = lazy(() => import('./pages/WorkforceOSPage'));
const LBIAdminPage = lazy(() => import('./pages/LBIAdminPage'));
const SDIAdminPage = lazy(() => import('./pages/SDIAdminPage'));
const StudentCompetencyPage = lazy(() => import('./pages/StudentCompetencyPage'));
const CompetencyDashboard = lazy(() => import('./components/CompetencyDashboard'));
const ScientificCompetencyPage = lazy(() => import('./pages/ScientificCompetencyPage'));
const MarketIntelligencePage = lazy(() => import('./pages/MarketIntelligencePage'));
const AIGovernancePage = lazy(() => import('./pages/AIGovernancePage'));
const EnterpriseWorkforceOSPage = lazy(() => import('./pages/EnterpriseWorkforceOSPage'));
const CompetencyIntelligencePage = lazy(() => import('./pages/CompetencyIntelligencePage'));
const CompetencyGapAnalysisPage = lazy(() => import('./pages/competency/GapAnalysisPage'));
const CompetencyBenchmarksPage = lazy(() => import('./pages/competency/IndustryBenchmarksPage'));
const CompetencyCareerStagePage = lazy(() => import('./pages/competency/CareerStagePage'));
const CompetencyRoleTransitionPage = lazy(() => import('./pages/competency/RoleTransitionPage'));
const CompetencyHiringPredictionPage = lazy(() => import('./pages/competency/HiringPredictionPage'));
const CompetencyGrowthSimulationPage = lazy(() => import('./pages/competency/GrowthSimulationPage'));
const CompetencyLearningPathsPage = lazy(() => import('./pages/competency/LearningPathsPage'));
const JoinSessionPage = lazy(() => import('./pages/JoinSessionPage').then(m => ({ default: m.JoinSessionPage })));
const AboutPage = lazy(() => import('./pages/AboutPage').then(m => ({ default: m.AboutPage })));
const LeadershipPage = lazy(() => import('./pages/LeadershipPage').then(m => ({ default: m.LeadershipPage })));
const PressPage = lazy(() => import('./pages/PressPage').then(m => ({ default: m.PressPage })));
const MiniCheckPage = lazy(() => import('./pages/MiniCheckPage').then(m => ({ default: m.MiniCheckPage })));
const StressCheckPage = lazy(() => import('./pages/StressCheckPage').then(m => ({ default: m.StressCheckPage })));
const LBIProductPage = lazy(() => import('./pages/LBIProductPage').then(m => ({ default: m.LBIProductPage })));
const IntelligenceFrameworksPage = lazy(() => import('./pages/IntelligenceFrameworksPage').then(m => ({ default: m.IntelligenceFrameworksPage })));
const PricingPage = lazy(() => import('./pages/PricingPage').then(m => ({ default: m.PricingPage })));
const AIPoweredReportsPage = lazy(() => import('./pages/AIPoweredReportsPage').then(m => ({ default: m.AIPoweredReportsPage })));
const MetryxAIAssistantScreenPage = lazy(() => import('./pages/MetryxAIAssistantPage').then(m => ({ default: m.MetryxAIAssistantPage })));
const PublicJobApplicationPage = lazy(() => import('./pages/PublicJobApplicationPage'));
const CompleteApplicationPage = lazy(() => import('./pages/CompleteApplicationPage'));
const K12SchoolsPage = lazy(() => import('./pages/K12SchoolsPage').then(m => ({ default: m.K12SchoolsPage })));
const CoachingPage = lazy(() => import('./pages/CoachingPage').then(m => ({ default: m.CoachingPage })));
const EdTechPage = lazy(() => import('./pages/EdTechPage').then(m => ({ default: m.EdTechPage })));
const EnterpriseHiringPage = lazy(() => import('./pages/EnterpriseHiringPage').then(m => ({ default: m.EnterpriseHiringPage })));
const CampusRecruitPage = lazy(() => import('./pages/CampusRecruitPage').then(m => ({ default: m.CampusRecruitPage })));
const WorkforceAnalyticsPage = lazy(() => import('./pages/WorkforceAnalyticsPage').then(m => ({ default: m.WorkforceAnalyticsPage })));
const EmployeeDevelopmentPage = lazy(() => import('./pages/EmployeeDevelopmentPage').then(m => ({ default: m.EmployeeDevelopmentPage })));
const LDIntegrationPage = lazy(() => import('./pages/LDIntegrationPage').then(m => ({ default: m.LDIntegrationPage })));
const DocumentationPage = lazy(() => import('./pages/DocumentationPage').then(m => ({ default: m.DocumentationPage })));
const CaseStudiesPage = lazy(() => import('./pages/CaseStudiesPage').then(m => ({ default: m.CaseStudiesPage })));
const ResearchPapersPage = lazy(() => import('./pages/ResearchPapersPage').then(m => ({ default: m.ResearchPapersPage })));
const HelpCenterPage = lazy(() => import('./pages/HelpCenterPage').then(m => ({ default: m.HelpCenterPage })));
const ContactPage = lazy(() => import('./pages/ContactPage').then(m => ({ default: m.ContactPage })));
const MentorMarketplacePage = lazy(() => import('./pages/MentorMarketplacePage').then(m => ({ default: m.MentorMarketplacePage })));
const MentorProfilePage = lazy(() => import('./pages/MentorProfilePage').then(m => ({ default: m.MentorProfilePage })));
const GamificationPage = lazy(() => import('./pages/GamificationPage'));
const InterviewQuestionBankPage = lazy(() => import('./pages/InterviewQuestionBankPage'));
const CompetitiveExamPortal = lazy(() => import('./pages/CompetitiveExamPortal'));
const MentorDashboardPage = lazy(() => import('./pages/MentorDashboardPage').then(m => ({ default: m.MentorDashboardPage })));
const LearningPathsPage = lazy(() => import('./pages/LearningPathsPage').then(m => ({ default: m.LearningPathsPage })));
const NotificationPreferencesPage = lazy(() => import('./pages/NotificationPreferencesPage'));
const OnboardingRegisterPage = lazy(() => import('./pages/OnboardingRegisterPage').then(m => ({ default: m.OnboardingRegisterPage })));
const StudentCareerPage = lazy(() => import('./pages/career-seeker/StudentCareerPage'));
const ParentCareerPage = lazy(() => import('./pages/career-seeker/ParentCareerPage'));
const InstitutionCareerPage = lazy(() => import('./pages/career-seeker/InstitutionCareerPage'));
const MentorCareerPage = lazy(() => import('./pages/career-seeker/MentorCareerPage'));
const DocumentUploadPage = lazy(() => import('./pages/DocumentUploadPage'));
const MentorAgreementPage = lazy(() => import('./pages/MentorAgreementPage'));
const CareerBuilderPage  = lazy(() => import('./pages/CareerBuilderPage').then(m => ({ default: m.CareerBuilderPage })));
const CareerDiscoveryPage = lazy(() => import('./pages/CareerDiscoveryPage').then(m => ({ default: m.CareerDiscoveryPage })));
const EmployerPortalPage = lazy(() => import('./pages/EmployerPortalPage').then(m => ({ default: m.EmployerPortalPage })));
const ParentConsentApprovePage = lazy(() => import('./pages/ParentConsentApprovePage').then(m => ({ default: m.ParentConsentApprovePage })));
const PassportRecruiterView = lazy(() => import('./components/passport/EmployabilityPassport').then(m => ({ default: m.PassportRecruiterView })));

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-3 border-[var(--metryx-blue)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      </div>
    </div>
  );
}

export type Screen = 
  // Core Navigation
  | 'landing'
  | 'site-map'
  | 'login' 
  | 'registration'
  | 'forgot-password'
  | 'role-selection' 
  // Unified Dashboards (Parent & Institute)
  | 'unified-parent-dashboard'
  | 'unified-institute-dashboard'
  // Parent Actions
  | 'generate-exam' 
  | 'preview-blueprint'
  | 'parent-lbi'
  // Institute Actions
  | 'enrollment-requests' 
  | 'exam-templates'
  // Student Flow (Mobile Dark Mode)
  | 'student-dashboard'
  | 'student-exam-list' 
  | 'exam-player' 
  | 'results-summary'
  | 'student-consent-explainer'
  | 'assessment-start'
  | 'interactive-task'
  | 'context-transition'
  | 'focus-task'
  | 'reflection-screen'
  | 'session-recorded'
  // Settings
  | 'theme-settings'
  // Phase 1 Ontology Explorer
  | 'ontology-explorer'
  // Phase 2 Adaptive Benchmark Dashboard
  | 'benchmark-dashboard'
  // Phase 3 Career Mobility & Pathway Intelligence
  | 'career-mobility'
  // Phase 4 Longitudinal & Workforce Intelligence
  | 'trajectory-dashboard'
  | 'adaptive-causal'
  | 'workforce-insights'
  // Phase 5 Enterprise & Governance
  | 'enterprise-intelligence'
  | 'governance-console'
  | 'workforce-os'
  // Phase 2 Scientific Competency Intelligence
  | 'scientific-competency'
  // Phase 3 Market Intelligence
  | 'market-intelligence'
  | 'ai-governance'
  | 'enterprise-workforce-os'
  // Employer / HR Persona dashboard (hosts Workforce Insights + Enterprise WOS)
  | 'employer-dashboard'
  // EXAM READY™ Module
  | 'exam-ready'
  | 'exam-ready-compare'
  | 'exam-ready-login'
  | 'exam-ready-checkout'
  | 'exam-ready-assessment-start'
  | 'exam-ready-assessment-start-all'
  | 'exam-ready-assessment'
  | 'exam-ready-report-status'
  | 'exam-ready-report-view'
  | 'exam-ready-disclaimer'
  // Legal & Support Pages
  | 'privacy'
  | 'terms'
  | 'request-demo'
  | 'support'
  // NGO Dashboard
  | 'ngo-dashboard'
  // HR & Recruitment
  | 'hr-dashboard'
  | 'careers'
  // Company Pages
  | 'about'
  | 'leadership'
  | 'press'
  // Assessment Pages
  | 'mini-check'
  | 'stress-check'
  // Product Pages
  | 'intelligence-frameworks'
  | 'lbi-product'
  | 'pricing'
  | 'ai-powered-reports'
  | 'metryxai-assistant'
  // Solution Pages
  | 'k12-schools'
  | 'coaching'
  | 'edtech'
  | 'enterprise-hiring'
  | 'campus-recruit'
  | 'workforce-analytics'
  | 'employee-development'
  | 'ld-integration'
  // Resource Pages
  | 'docs'
  | 'case-studies'
  | 'research'
  | 'help'
  | 'contact'
  // Super Admin
  | 'super-admin'
  | 'admin-pricing'
  | 'admin-competency'
  | 'admin-lbi'
  | 'admin-sdi'
  | 'student-competency'
  // LBI Assessment
  | 'lbi-assessment'
  // Mentor Marketplace
  | 'mentor-marketplace'
  | 'mentor-profile'
  // Video Sessions
  | 'join-session'
  | 'mentor-dashboard'
  // Learning Paths
  | 'learning-paths'
  // Notification Preferences
  | 'notification-preferences'
  // Public Onboarding Registration
  | 'onboarding-register'
  | 'document-upload'
  | 'mentor-agreement'
  // Competency Intelligence Platform
  | 'competency-intelligence'
  | 'competency-gap-analysis'
  | 'competency-benchmarks'
  | 'competency-career-stages'
  | 'competency-role-transition'
  | 'competency-hiring-prediction'
  | 'competency-growth-simulation'
  | 'competency-learning-paths'
  | 'career-builder'
  | 'career-discovery'
  | 'employer-portal'
  | 'interview-bank-admin'
  | 'student-career-portal'
  | 'parent-career-portal'
  | 'institution-career-portal'
  | 'mentor-career-portal'
  | 'parent-consent-approve'
  | 'passport-public'
  | 'competitive-exam-portal'
  | 'job-apply'
  | 'complete-application'
  | 'gamification';

interface ExamReadyState {
  isAuthenticated: boolean;
  planId: string;
  board: string;
  grade: string;
  attemptId: string;
  childName: string;
  childId: string;
}

export default function App() {
  // Check URL for screen parameter on initial load (supports both path and query params)
  const getInitialScreen = (): Screen => {
    const path = window.location.pathname.slice(1);
    // Document upload links: /upload/:id/documents
    if (path.startsWith('upload/')) return 'document-upload';
    // Mentor agreement links: /mentor-agreement/:code/sign
    if (path.startsWith('mentor-agreement/')) return 'mentor-agreement';
    // Parent consent approval links: /parent-consent/:token
    if (path.startsWith('parent-consent/')) return 'parent-consent-approve';
    // Public employability passport links: /passport/:token
    if (path.startsWith('passport/')) return 'passport-public';
    // Public job application links: /apply/:token
    if (path.startsWith('apply/')) return 'job-apply';
    // Applicant self-completion links: /complete/:token
    if (path.startsWith('complete/')) return 'complete-application';
    if (path && isValidScreen(path)) return path as Screen;
    const params = new URLSearchParams(window.location.search);
    const screen = params.get('screen');
    if (screen && isValidScreen(screen)) return screen as Screen;
    return 'landing';
  };
  
  const isValidScreen = (screen: string): boolean => {
    const validScreens: Screen[] = [
      'landing', 'site-map', 'login', 'registration', 'forgot-password', 'role-selection',
      'unified-parent-dashboard', 'unified-institute-dashboard', 'generate-exam', 'preview-blueprint',
      'parent-lbi', 'enrollment-requests', 'exam-templates', 'student-dashboard',
      'student-exam-list', 'exam-player', 'results-summary', 'student-consent-explainer',
      'assessment-start', 'interactive-task', 'context-transition', 'focus-task',
      'reflection-screen', 'session-recorded', 'theme-settings', 'ontology-explorer', 'benchmark-dashboard', 'career-mobility', 'trajectory-dashboard', 'adaptive-causal', 'workforce-insights', 'enterprise-intelligence', 'governance-console', 'workforce-os', 'scientific-competency', 'market-intelligence', 'ai-governance', 'enterprise-workforce-os', 'employer-dashboard', 'exam-ready', 'exam-ready-compare',
      'exam-ready-login', 'exam-ready-checkout', 'exam-ready-assessment-start', 'exam-ready-assessment-start-all', 'exam-ready-assessment',
      'exam-ready-report-status', 'exam-ready-report-view', 'exam-ready-disclaimer',
      'privacy', 'terms', 'request-demo', 'support', 'ngo-dashboard', 'hr-dashboard', 'careers',
      'about', 'leadership', 'press', 'mini-check', 'stress-check', 'intelligence-frameworks', 'lbi-product', 'pricing', 'ai-powered-reports', 'metryxai-assistant', 'k12-schools', 'coaching', 'edtech', 'enterprise-hiring', 'campus-recruit', 'workforce-analytics', 'employee-development', 'ld-integration',
      'docs', 'case-studies', 'research', 'help', 'contact', 'super-admin', 'admin-pricing', 'admin-competency', 'admin-lbi', 'admin-sdi', 'student-competency', 'lbi-assessment',
      'mentor-marketplace', 'mentor-profile', 'mentor-dashboard', 'join-session',
      'learning-paths', 'notification-preferences', 'onboarding-register', 'document-upload', 'mentor-agreement',
      'competency-intelligence',
      'competency-gap-analysis', 'competency-benchmarks', 'competency-career-stages',
      'competency-role-transition', 'competency-hiring-prediction',
      'competency-growth-simulation', 'competency-learning-paths',
      'career-builder',
      'career-discovery',
      'employer-portal',
      'job-apply',
      'complete-application',
      'interview-bank-admin',
      'competitive-exam-portal',
      'student-career-portal', 'parent-career-portal', 'institution-career-portal', 'mentor-career-portal',
      'gamification'
    ];
    return validScreens.includes(screen as Screen);
  };

  // Deep-link: read ?session=<id>&tab=report at startup — works for guests AND
  // logged-in users (modal renders globally on top of whatever screen loads)
  const DEEPLINK_SESSION_KEY = 'mx_deeplink_session';
  const [deepLinkSessionId, setDeepLinkSessionId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('session');
    const tab = params.get('tab');
    if (sid && tab === 'report') {
      // Remove only the deep-link params, preserve any other query params
      params.delete('session');
      params.delete('tab');
      const remaining = params.toString();
      const cleanUrl = window.location.pathname + (remaining ? `?${remaining}` : '');
      window.history.replaceState({}, '', cleanUrl);
      // Persist so the report survives modal close / tab reopen within the same browser session
      sessionStorage.setItem('mx_deeplink_session', sid);
      return sid;
    }
    // Restore from sessionStorage if navigated back or tab was reopened
    return sessionStorage.getItem('mx_deeplink_session');
  });
  // Controls modal visibility independently from the stored session ID
  const [deepLinkModalOpen, setDeepLinkModalOpen] = useState<boolean>(() => !!sessionStorage.getItem('mx_deeplink_session'));

  const [currentScreen, setCurrentScreen] = useState<Screen>(getInitialScreen());

  // Pill dismiss state: user can × the pill away for the rest of the session
  const PILL_DISMISSED_KEY = 'mx_pill_dismissed';
  const [pillDismissed, setPillDismissed] = useState<boolean>(() => sessionStorage.getItem('mx_pill_dismissed') === '1');
  const dismissPill = () => {
    sessionStorage.setItem(PILL_DISMISSED_KEY, '1');
    setPillDismissed(true);
  };

  // Email CTA deep-link: ?concern=<name> → auto-open assessment modal on landing
  // Used by the "Start the Insight Stage" CTA button in the report email
  const [deepLinkConcern] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const concern = params.get('concern');
    if (concern) {
      params.delete('concern');
      const remaining = params.toString();
      const cleanUrl = window.location.pathname + (remaining ? `?${remaining}` : '');
      window.history.replaceState({}, '', cleanUrl);
      return concern;
    }
    return null;
  });

  // Employer assessment-invite deep-link: ?assess=1&email=<addr> → open the assessment
  // with the candidate's email pre-bound, so a completed session attaches back to the
  // candidate's card (capadex_sessions.guest_email = candidate.email join). Returns ''
  // when assess=1 but no email, null when not an invite link.
  const [deepLinkAssessEmail] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('assess') !== '1') return null;
    const email = params.get('email') || '';
    params.delete('assess');
    params.delete('email');
    const remaining = params.toString();
    const cleanUrl = window.location.pathname + (remaining ? `?${remaining}` : '');
    window.history.replaceState({}, '', cleanUrl);
    return email;
  });

  // Fire after LandingPage has mounted (short delay to let it register its listener)
  useEffect(() => {
    if (!deepLinkConcern && deepLinkAssessEmail === null) return;
    const t = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('mx-open-assessment', { detail: {
        concern: deepLinkConcern || undefined,
        email: deepLinkAssessEmail || undefined,
      } }));
    }, 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  // Reset pill dismissal when user returns to the landing page so the pill
  // reappears the next time they navigate away (pill is hidden on landing anyway)
  useEffect(() => {
    if (currentScreen === 'landing') {
      sessionStorage.removeItem(PILL_DISMISSED_KEY);
      setPillDismissed(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScreen]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.slice(1);
      if (path.startsWith('upload/')) {
        setCurrentScreen('document-upload');
      } else if (path.startsWith('mentor-agreement/')) {
        setCurrentScreen('mentor-agreement');
      } else if (path.startsWith('passport/')) {
        setCurrentScreen('passport-public');
      } else if (path.startsWith('apply/')) {
        setCurrentScreen('job-apply');
      } else if (path.startsWith('complete/')) {
        setCurrentScreen('complete-application');
      } else if (path && isValidScreen(path)) {
        setCurrentScreen(path as Screen);
      } else {
        setCurrentScreen('landing');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Handle forced logout on 401 from any page
  useEffect(() => {
    const handleLogout = () => {
      setIsMainAppLoggedIn(false);
      setCurrentScreen('login');
      window.history.pushState({}, '', '/login');
    };
    window.addEventListener('metryx:logout', handleLogout);
    return () => window.removeEventListener('metryx:logout', handleLogout);
  }, []);

  // Check for existing session (JWT in localStorage)
  useEffect(() => {
    const checkSession = async () => {
      try {
        const token = localStorage.getItem('metryx_token');
        if (!token) return;
        const res = await fetch('/api/user', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const rawData = await res.json();
          const userData = rawData.user ?? rawData;
          setIsMainAppLoggedIn(true);
          setExamReadyState(prev => ({ ...prev, isAuthenticated: true }));
          const currentPath = window.location.pathname.slice(1);
          const publicOnlyScreens = ['landing', 'login', 'registration', 'forgot-password', 'role-selection', ''];
          if (publicOnlyScreens.includes(currentPath)) {
            const target = userData.dashboardTarget;
            if (target && isValidScreen(target)) {
              setCurrentScreen(target as Screen);
              window.history.replaceState({}, '', `/${target}`);
            }
          }
        }
      } catch {}
    };
    checkSession();
  }, []);
  const [initialTab, setInitialTab] = useState<'exams' | 'lbi'>('exams');
  const [lbiTab, setLbiTab] = useState<'assessments' | 'insights' | 'reports'>('assessments');
  const [selectedExamId, setSelectedExamId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('examId');
  });
  // Track if user is logged in to main app
  const [isMainAppLoggedIn, setIsMainAppLoggedIn] = useState(false);

  // ── Global search ────────────────────────────────────────────────────────────
  const [showAppSearch, setShowAppSearch] = useState(false);

  const getSearchRole = useCallback((screen: string): SearchRole => {
    if (screen === 'unified-parent-dashboard') return 'parent';
    if (['unified-institute-dashboard', 'ngo-dashboard'].includes(screen)) return 'institute';
    if (['hr-dashboard', 'competency-dashboard'].includes(screen)) return 'hr';
    return 'student';
  }, []);

  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowAppSearch(s => !s);
      }
    };
    const eventHandler = () => setShowAppSearch(true);
    window.addEventListener('keydown', keyHandler);
    window.addEventListener('metryx:open-search', eventHandler);
    return () => {
      window.removeEventListener('keydown', keyHandler);
      window.removeEventListener('metryx:open-search', eventHandler);
    };
  }, []);

  // Clean up old persistent dismiss flag so returning users see the popup again
  useEffect(() => { localStorage.removeItem('mx_chat_modal_dismissed'); }, []);

  // Clear dismiss flag on every page load so popup re-appears on refresh
  useEffect(() => { sessionStorage.removeItem('mx_chat_modal_dismissed'); }, []);

  // Chat modal: show on landing page, dismiss hides until next page load
  const [showChatModal, setShowChatModal] = useState(
    () => getInitialScreen() === 'landing'
  );
  const dismissChatModal = () => {
    sessionStorage.setItem('mx_chat_modal_dismissed', '1');
    setShowChatModal(false);
  };
  useEffect(() => {
    if (currentScreen !== 'landing' || isMainAppLoggedIn) {
      setShowChatModal(false);
    } else if (!sessionStorage.getItem('mx_chat_modal_dismissed')) {
      setShowChatModal(true);
    }
  }, [currentScreen, isMainAppLoggedIn]);

  // Route guard: redirect away from auth pages when logged in
  useEffect(() => {
    const authPages: Screen[] = ['login' as Screen, 'registration' as Screen];
    if (isMainAppLoggedIn && authPages.includes(currentScreen)) {
      // Use last known dashboard or default to parent
      const lastDashboard = (localStorage.getItem('metryx_dashboard') || 'unified-parent-dashboard') as Screen;
      setCurrentScreen(lastDashboard);
      window.history.replaceState({}, '', `/${lastDashboard}`);
    }
  }, [currentScreen, isMainAppLoggedIn]);
  
  // LBI Assessment state
  const [lbiAgeBandId, setLbiAgeBandId] = useState<string>('ab1');
  const [lbiDomainId, setLbiDomainId] = useState<string>('d1');

  // Mentor Marketplace state
  const [selectedMentorId, setSelectedMentorId] = useState<string>('');
  const [autoBookMentor, setAutoBookMentor] = useState(false);


  // EXAM READY™ state - inherits auth from main app
  const [examReadyState, setExamReadyState] = useState<ExamReadyState>({
    isAuthenticated: false,
    planId: '',
    board: '',
    grade: '',
    attemptId: '',
    childName: '',
    childId: '',
  });

  const handleNavigate = (screen: Screen | string, data?: Record<string, unknown>) => {
    if (data?.childId) {
      setSelectedChildId(data.childId as string);
    }
    if (data?.tab) {
      setInitialTab(data.tab as 'exams' | 'lbi');
    }
    if (data?.lbiTab) {
      setLbiTab(data.lbiTab as 'assessments' | 'insights' | 'reports');
    }
    if (data?.examId) {
      setSelectedExamId(data.examId as string);
    }
    if (data?.ageBandId) {
      setLbiAgeBandId(data.ageBandId as string);
    }
    if (data?.domainId) {
      setLbiDomainId(data.domainId as string);
    }
    if (data?.mentorId) {
      setSelectedMentorId(data.mentorId as string);
    }

    if (data?.autoBook !== undefined) {
      setAutoBookMentor(data.autoBook as boolean);
    }
    // Handle EXAM READY data
    if (data?.planId) {
      setExamReadyState(prev => ({ ...prev, planId: data.planId as string }));
    }
    if (data?.board) {
      setExamReadyState(prev => ({ ...prev, board: data.board as string }));
    }
    if (data?.grade) {
      setExamReadyState(prev => ({ ...prev, grade: data.grade as string }));
    }
    if (data?.attemptId) {
      setExamReadyState(prev => ({ ...prev, attemptId: data.attemptId as string }));
    }
    if (data?.childName) {
      setExamReadyState(prev => ({ ...prev, childName: data.childName as string }));
    }
    if (data?.childId) {
      setExamReadyState(prev => ({ ...prev, childId: data.childId as string }));
    }
    
    // Track main app login - when navigating to dashboards, user is logged in
    const dashboardScreens = ['unified-parent-dashboard', 'unified-institute-dashboard', 'student-dashboard', 'mentor-dashboard', 'role-selection'];
    if (dashboardScreens.includes(screen as string)) {
      setIsMainAppLoggedIn(true);
      setExamReadyState(prev => ({ ...prev, isAuthenticated: true }));
      localStorage.setItem('metryx_dashboard', screen as string);
    }
    
    // When navigating to exam-ready screens, inherit auth from main app
    if ((screen as string).startsWith('exam-ready') && isMainAppLoggedIn) {
      setExamReadyState(prev => ({ ...prev, isAuthenticated: true }));
    }

    // Route guard: redirect logged-in users away from auth pages
    const authPages = ['login', 'registration', 'exam-ready-login'];
    if (isMainAppLoggedIn && authPages.includes(screen as string)) {
      const token = localStorage.getItem('metryx_token');
      if (token) {
        screen = (localStorage.getItem('metryx_dashboard') || 'unified-parent-dashboard') as typeof screen;
      }
    }

    // Split optional query string (e.g. 'career-builder?tab=assessment' or
    // 'benchmark-dashboard?user_id=…&org_id=…'). The screen-state must be the
    // bare screen name; the query goes into the URL only so deep-linked pages
    // can read it via window.location.search.
    const rawTarget = String(screen);
    const qIdx = rawTarget.indexOf('?');
    const screenOnly = qIdx >= 0 ? rawTarget.slice(0, qIdx) : rawTarget;
    const queryString = qIdx >= 0 ? rawTarget.slice(qIdx) : '';

    // Update browser URL for path-based navigation
    const newPath = screenOnly === 'landing' ? `/${queryString}` : `/${screenOnly}${queryString}`;
    window.history.pushState({}, '', newPath);

    setCurrentScreen(screenOnly as Screen);
  };

  const [examReadyReturnScreen, setExamReadyReturnScreen] = useState<string>('exam-ready-checkout');

  const handleExamReadyLoginSuccess = () => {
    setExamReadyState(prev => ({ ...prev, isAuthenticated: true }));
    setIsMainAppLoggedIn(true);
    handleNavigate(examReadyReturnScreen as Screen);
  };

  // Route guard helper: renders login with return-to tracking for protected exam-ready screens
  const examReadyAuthGuard = (screen: string, component: React.ReactNode) => {
    if (examReadyState.isAuthenticated) return component;
    // Save intended destination so login redirects back here
    if (examReadyReturnScreen !== screen) setExamReadyReturnScreen(screen);
    return <ExamReadyLogin onNavigate={handleNavigate} onLoginSuccess={handleExamReadyLoginSuccess} />;
  };

  return (
    <QueryClientProvider client={queryClient}>
    <AuthProvider>
      {currentScreen === 'landing' && !isMainAppLoggedIn && (
        <LandingPage
          onNavigate={handleNavigate}
          deepLinkSessionId={deepLinkSessionId}
          deepLinkModalOpen={deepLinkModalOpen}
          onReopenReport={() => setDeepLinkModalOpen(true)}
          onClearDeepLink={() => {
            sessionStorage.removeItem(DEEPLINK_SESSION_KEY);
            setDeepLinkSessionId(null);
            setDeepLinkModalOpen(false);
          }}
        />
      )}
      {currentScreen === 'site-map' && <SiteMap onNavigate={handleNavigate} />}
      {currentScreen === 'login' && <Login onNavigate={handleNavigate} />}
      {currentScreen === 'registration' && <Registration onNavigate={handleNavigate} />}
      {currentScreen === 'forgot-password' && <ForgotPassword onNavigate={handleNavigate} />}
      {currentScreen === 'role-selection' && <RoleSelection onNavigate={handleNavigate} />}
      
      <Suspense fallback={<LoadingSpinner />}>
        {currentScreen === 'unified-parent-dashboard' && <UnifiedParentDashboard onNavigate={handleNavigate} selectedChildId={selectedChildId} onChildChange={setSelectedChildId} />}
        {currentScreen === 'unified-institute-dashboard' && <UnifiedInstituteDashboard onNavigate={handleNavigate} />}
        {currentScreen === 'generate-exam' && <GenerateExam onNavigate={handleNavigate} />}
        {currentScreen === 'preview-blueprint' && <PreviewBlueprint onNavigate={handleNavigate} />}
        {currentScreen === 'parent-lbi' && <ParentLbiScreen onNavigate={handleNavigate} initialChildId={selectedChildId} onChildChange={setSelectedChildId} initialLbiTab={lbiTab} />}
        {currentScreen === 'enrollment-requests' && <EnrollmentRequests onNavigate={handleNavigate} />}
        {currentScreen === 'exam-templates' && <ExamTemplates onNavigate={handleNavigate} />}
        {currentScreen === 'student-dashboard' && <StudentDashboard onNavigate={handleNavigate} />}
        {currentScreen === 'student-exam-list' && <StudentExamList onNavigate={handleNavigate} initialTab={initialTab} />}
        {currentScreen === 'exam-player' && <ExamPlayer onNavigate={handleNavigate} examId={selectedExamId || undefined} />}
        {currentScreen === 'results-summary' && <ResultsSummary onNavigate={handleNavigate} />}
        {currentScreen === 'student-consent-explainer' && <StudentConsentExplainer onNavigate={handleNavigate} />}
        {currentScreen === 'assessment-start' && <AssessmentStart onNavigate={handleNavigate} />}
        {currentScreen === 'interactive-task' && <InteractiveTask onNavigate={handleNavigate} />}
        {currentScreen === 'context-transition' && <ContextTransition onNavigate={handleNavigate} />}
        {currentScreen === 'focus-task' && <FocusTask onNavigate={handleNavigate} />}
        {currentScreen === 'reflection-screen' && <ReflectionScreen onNavigate={handleNavigate} />}
        {currentScreen === 'session-recorded' && <SessionRecorded onNavigate={handleNavigate} />}
        {currentScreen === 'theme-settings' && <ThemeSettings onNavigate={handleNavigate} />}
        
        {currentScreen === 'exam-ready' && <ExamReadyLanding onNavigate={handleNavigate} />}
        {currentScreen === 'exam-ready-compare' && <ExamReadyCompare onNavigate={handleNavigate} />}
        {currentScreen === 'exam-ready-login' && (
          <ExamReadyLogin 
            onNavigate={handleNavigate} 
            onLoginSuccess={handleExamReadyLoginSuccess}
          />
        )}
        {currentScreen === 'exam-ready-checkout' && examReadyAuthGuard('exam-ready-checkout',
          <ExamReadyCheckout
            onNavigate={handleNavigate}
            isAuthenticated={examReadyState.isAuthenticated}
            initialChildName={examReadyState.childName}
            initialBoard={examReadyState.board}
            initialGrade={examReadyState.grade}
            initialChildId={examReadyState.childId}
          />
        )}
        {currentScreen === 'exam-ready-assessment-start' && examReadyAuthGuard('exam-ready-assessment-start',
          <ExamReadyAssessmentStart
            planId={examReadyState.planId}
            board={examReadyState.board}
            grade={examReadyState.grade}
            childName={examReadyState.childName}
            childId={examReadyState.childId}
            onNavigate={handleNavigate}
          />
        )}
        {currentScreen === 'exam-ready-assessment-start-all' && examReadyAuthGuard('exam-ready-assessment-start-all',
          <ExamReadyAssessmentStartAll onNavigate={handleNavigate} />
        )}
        {currentScreen === 'exam-ready-assessment' && examReadyAuthGuard('exam-ready-assessment',
          <ExamReadyAssessment
            attemptId={examReadyState.attemptId}
            onNavigate={handleNavigate}
          />
        )}
        {currentScreen === 'exam-ready-report-status' && examReadyAuthGuard('exam-ready-report-status',
          <ExamReadyReportStatus
            attemptId={examReadyState.attemptId}
            onNavigate={handleNavigate}
          />
        )}
        {currentScreen === 'exam-ready-report-view' && examReadyAuthGuard('exam-ready-report-view',
          <ExamReadyReportView
            attemptId={examReadyState.attemptId}
            onNavigate={handleNavigate}
          />
        )}
        {currentScreen === 'exam-ready-disclaimer' && <ExamReadyDisclaimer onNavigate={handleNavigate} />}
        
        {currentScreen === 'privacy' && <PrivacyPage onNavigate={handleNavigate} />}
        {currentScreen === 'terms' && <TermsPage onNavigate={handleNavigate} />}
        {currentScreen === 'support' && <SupportPage onNavigate={handleNavigate} />}
        {currentScreen === 'request-demo' && <RequestDemo onNavigate={handleNavigate} />}
        {currentScreen === 'ngo-dashboard' && <NGODashboard onNavigate={handleNavigate} />}
        {currentScreen === 'hr-dashboard' && <HRDashboard onNavigate={handleNavigate} />}
        {currentScreen === 'careers' && <CareersPage onNavigate={handleNavigate} />}
        {currentScreen === 'about' && <AboutPage onNavigate={handleNavigate} />}
        {currentScreen === 'leadership' && <LeadershipPage onNavigate={handleNavigate} />}
        {currentScreen === 'press' && <PressPage onNavigate={handleNavigate} />}
        {currentScreen === 'mini-check' && <MiniCheckPage onNavigate={handleNavigate} />}
        {currentScreen === 'stress-check' && <StressCheckPage onNavigate={handleNavigate} />}
        {currentScreen === 'intelligence-frameworks' && <IntelligenceFrameworksPage onNavigate={handleNavigate} />}
        {currentScreen === 'lbi-product' && <LBIProductPage onNavigate={handleNavigate} />}
        {currentScreen === 'pricing' && <PricingPage role={'parent'} onNavigate={handleNavigate} />}
        {currentScreen === 'ai-powered-reports' && <AIPoweredReportsPage onNavigate={handleNavigate} />}
        {currentScreen === 'metryxai-assistant' && <MetryxAIAssistantScreenPage onNavigate={handleNavigate} />}
        {currentScreen === 'k12-schools' && <K12SchoolsPage onNavigate={handleNavigate} />}
        {currentScreen === 'coaching' && <CoachingPage onNavigate={handleNavigate} />}
        {currentScreen === 'edtech' && <EdTechPage onNavigate={handleNavigate} />}
        {currentScreen === 'enterprise-hiring' && <EnterpriseHiringPage onNavigate={handleNavigate} />}
        {currentScreen === 'campus-recruit' && <CampusRecruitPage onNavigate={handleNavigate} />}
        {currentScreen === 'workforce-analytics' && <WorkforceAnalyticsPage onNavigate={handleNavigate} />}
        {currentScreen === 'employee-development' && <EmployeeDevelopmentPage onNavigate={handleNavigate} />}
        {currentScreen === 'ld-integration' && <LDIntegrationPage onNavigate={handleNavigate} />}
        {currentScreen === 'docs' && <DocumentationPage onNavigate={handleNavigate} />}
        {currentScreen === 'case-studies' && <CaseStudiesPage onNavigate={handleNavigate} />}
        {currentScreen === 'research' && <ResearchPapersPage onNavigate={handleNavigate} />}
        {currentScreen === 'help' && <HelpCenterPage onNavigate={handleNavigate} />}
        {currentScreen === 'contact' && <ContactPage onNavigate={handleNavigate} />}
        {currentScreen === 'super-admin' && <SuperAdminDashboard onNavigate={handleNavigate} />}
        {currentScreen === 'admin-pricing' && <AdminPricingPage onBack={() => handleNavigate('super-admin')} />}
        {currentScreen === 'admin-competency' && <CompetencyAdminPage onNavigate={handleNavigate} />}
        {currentScreen === 'ontology-explorer' && <OntologyExplorerPage onNavigate={handleNavigate} />}
        {currentScreen === 'benchmark-dashboard' && <BenchmarkDashboardPage onNavigate={handleNavigate} />}
        {currentScreen === 'career-mobility' && <CareerMobilityPage onNavigate={handleNavigate} />}
        {currentScreen === 'trajectory-dashboard' && <TrajectoryDashboardPage onNavigate={handleNavigate} />}
        {currentScreen === 'adaptive-causal' && <AdaptiveCausalPage onNavigate={handleNavigate} />}
        {currentScreen === 'workforce-insights' && <WorkforceInsightsPage onNavigate={handleNavigate} />}
        {currentScreen === 'enterprise-intelligence' && <EnterpriseIntelligencePage onNavigate={handleNavigate} />}
        {currentScreen === 'governance-console' && <GovernanceConsolePage onNavigate={handleNavigate} />}
        {currentScreen === 'workforce-os' && <WorkforceOSPage onNavigate={handleNavigate} />}
        {currentScreen === 'scientific-competency' && <ScientificCompetencyPage onNavigate={handleNavigate} />}
        {currentScreen === 'market-intelligence' && <MarketIntelligencePage onNavigate={handleNavigate} />}
        {currentScreen === 'ai-governance' && <AIGovernancePage />}
        {currentScreen === 'enterprise-workforce-os' && <EnterpriseWorkforceOSPage />}
        {currentScreen === 'employer-dashboard' && <EmployerDashboardPage onNavigate={handleNavigate} />}
        {currentScreen === 'admin-lbi' && <LBIAdminPage onNavigate={handleNavigate} />}
        {currentScreen === 'admin-sdi' && <SDIAdminPage onNavigate={handleNavigate} />}
        {currentScreen === 'student-competency' && <StudentCompetencyPage onNavigate={handleNavigate} />}
        {currentScreen === 'lbi-assessment' && <LbiAssessmentPlayer sessionId={`${lbiAgeBandId}-${lbiDomainId}`} onComplete={() => handleNavigate('unified-parent-dashboard')} onExit={() => handleNavigate('unified-parent-dashboard')} />}
        {currentScreen === 'mentor-marketplace' && <MentorMarketplacePage onNavigate={handleNavigate} />}
        {currentScreen === 'mentor-profile' && <MentorProfilePage onNavigate={handleNavigate} mentorId={selectedMentorId} autoBook={autoBookMentor} />}
        {currentScreen === 'mentor-dashboard' && <MentorDashboardPage onNavigate={handleNavigate} />}
        {currentScreen === 'learning-paths' && <LearningPathsPage onNavigate={handleNavigate} />}
        {currentScreen === 'notification-preferences' && <NotificationPreferencesPage onNavigate={handleNavigate} />}
        {currentScreen === 'onboarding-register' && <OnboardingRegisterPage onNavigate={handleNavigate} />}
        {currentScreen === 'document-upload' && <DocumentUploadPage onNavigate={handleNavigate} />}
        {currentScreen === 'mentor-agreement' && <MentorAgreementPage onNavigate={handleNavigate} />}
        {currentScreen === 'competency-intelligence' && <CompetencyIntelligencePage onNavigate={handleNavigate} />}
        {currentScreen === 'competency-gap-analysis' && <CompetencyGapAnalysisPage onNavigate={handleNavigate} />}
        {currentScreen === 'competency-benchmarks' && <CompetencyBenchmarksPage onNavigate={handleNavigate} />}
        {currentScreen === 'competency-career-stages' && <CompetencyCareerStagePage onNavigate={handleNavigate} />}
        {currentScreen === 'competency-role-transition' && <CompetencyRoleTransitionPage onNavigate={handleNavigate} />}
        {currentScreen === 'competency-hiring-prediction' && <CompetencyHiringPredictionPage onNavigate={handleNavigate} />}
        {currentScreen === 'competency-growth-simulation' && <CompetencyGrowthSimulationPage onNavigate={handleNavigate} />}
        {currentScreen === 'competency-learning-paths' && <CompetencyLearningPathsPage onNavigate={handleNavigate} />}
        {currentScreen === 'career-builder'          && <CareerBuilderPage       onNavigate={handleNavigate} />}
        {currentScreen === 'career-discovery'        && <CareerDiscoveryPage     onNavigate={handleNavigate} />}
        {currentScreen === 'employer-portal'         && <EmployerPortalPage      onNavigate={handleNavigate} />}
        {currentScreen === 'interview-bank-admin'    && <InterviewQuestionBankPage onNavigate={handleNavigate} />}
        {currentScreen === 'competitive-exam-portal' && <CompetitiveExamPortal    onNavigate={handleNavigate} />}
        {currentScreen === 'student-career-portal'   && <StudentCareerPage       onNavigate={handleNavigate} />}
        {currentScreen === 'parent-career-portal'    && <ParentCareerPage        onNavigate={handleNavigate} />}
        {currentScreen === 'institution-career-portal' && <InstitutionCareerPage onNavigate={handleNavigate} />}
        {currentScreen === 'mentor-career-portal'    && <MentorCareerPage        onNavigate={handleNavigate} />}
        {currentScreen === 'join-session'            && <JoinSessionPage         onNavigate={handleNavigate} />}
        {currentScreen === 'parent-consent-approve'  && <ParentConsentApprovePage />}
        {currentScreen === 'passport-public'         && <PassportRecruiterView />}
        {currentScreen === 'job-apply'               && <PublicJobApplicationPage token={window.location.pathname.slice(7)} />}
        {currentScreen === 'complete-application'     && <CompleteApplicationPage token={window.location.pathname.slice(10)} />}
        {currentScreen === 'gamification'            && <GamificationPage onNavigate={handleNavigate} />}
      </Suspense>
      
      {/* Public AI demo widget — only on landing for anonymous visitors */}
      {currentScreen === 'landing' && !isMainAppLoggedIn && <AIDemoWidget />}

      {/* Pragati ChatWidget — mounted globally on non-landing screens so window
          'mx-open-chat' events from anywhere ("Show me how", "Ask Pragati",
          peer-benchmark CTA, etc.) actually surface the chat. We pre-seed the
          dismissed flag in sessionStorage so the widget mounts CLOSED — it
          only appears when an explicit event fires. */}
      {currentScreen !== 'landing' && !SCREENS_WITH_OWN_BOT.has(currentScreen) && <GlobalChatMount />}

      {/* ── Global Search (⌘K / Ctrl+K from any screen) ─────────────── */}
      {showAppSearch && (
        <GlobalSearch
          role={getSearchRole(currentScreen)}
          onNavigate={(screen) => handleNavigate(screen as Screen)}
          onClose={() => setShowAppSearch(false)}
        />
      )}

      {/* ── Floating report pill: visible on all non-landing pages when report is stored ── */}
      <AnimatePresence>
        {deepLinkSessionId && !deepLinkModalOpen && !pillDismissed && currentScreen !== 'landing' && (
          <motion.div
            key="report-pill"
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.9 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              zIndex: 60,
              display: 'flex',
              alignItems: 'center',
              borderRadius: '9999px',
              background: 'linear-gradient(135deg, #344E86 0%, #1E2B4A 100%)',
              border: '1px solid rgba(255,255,255,0.18)',
              boxShadow: '0 8px 28px rgba(52,78,134,0.38)',
              fontFamily: "'Inter', system-ui, sans-serif",
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            <button
              onClick={() => {
                sessionStorage.removeItem(PILL_DISMISSED_KEY);
                setPillDismissed(false);
                setDeepLinkModalOpen(true);
              }}
              aria-label="Reopen your CAPADEX report"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px 10px 18px',
                background: 'none',
                border: 'none',
                color: '#E0E7FF',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => (e.currentTarget.closest('div') as HTMLDivElement | null)?.style.setProperty('box-shadow', '0 10px 36px rgba(52,78,134,0.55)')}
              onMouseLeave={e => (e.currentTarget.closest('div') as HTMLDivElement | null)?.style.setProperty('box-shadow', '0 8px 28px rgba(52,78,134,0.38)')}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.15)',
                  flexShrink: 0,
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#A5B4FC" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </span>
              Your report is ready
            </button>
            <button
              onClick={dismissPill}
              aria-label="Dismiss report pill"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                marginRight: '8px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: '#A5B4FC',
                cursor: 'pointer',
                flexShrink: 0,
                fontSize: '14px',
                lineHeight: 1,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.22)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Deep-link report modal: opens on top of any screen ───────── */}
      {deepLinkSessionId && (
        <Suspense fallback={null}>
          <FreeAssessmentModalGlobal
            open={deepLinkModalOpen}
            onOpenChange={(v) => {
              setDeepLinkModalOpen(v);
              if (!v) {
                sessionStorage.removeItem(PILL_DISMISSED_KEY);
                setPillDismissed(false);
              }
            }}
            onNavigate={(s) => handleNavigate(s as Screen)}
            initialSessionId={deepLinkSessionId}
            onNewAssessmentStarted={() => {
              sessionStorage.removeItem(DEEPLINK_SESSION_KEY);
              setDeepLinkSessionId(null);
              setDeepLinkModalOpen(false);
            }}
          />
        </Suspense>
      )}
    </AuthProvider>
    </QueryClientProvider>
  );
}
