import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Screen } from '../App';
import { 
  Home, LogIn, UserPlus, Key, Users, Building2, GraduationCap,
  ClipboardList, FileText, Settings, Brain, Play, CheckCircle,
  MessageSquare, Lightbulb, Target, BookOpen, Award, CreditCard,
  FileCheck, Eye, Scale, ArrowRight, Map, Heart, Briefcase,
  School, Rocket, Cpu, Sparkles, Newspaper, Mail, HelpCircle,
  BarChart3, Search, Star, LayoutDashboard, Beaker,
  Gauge, GitMerge, UserCheck, TrendingUp, FileSignature, Upload,
  Network, Video, Gamepad2, ListChecks, Swords, ShieldCheck, Baby,
  ExternalLink, Zap, Compass
} from 'lucide-react';

interface SiteMapProps {
  onNavigate: (screen: Screen) => void;
}

interface PageLink {
  screen?: Screen;
  href?: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

interface PageCategory {
  title: string;
  description: string;
  color: string;
  pages: PageLink[];
}

const categories: PageCategory[] = [
  {
    title: "Public Pages",
    description: "Landing and marketing pages",
    color: "#1BA89C",
    pages: [
      { screen: 'landing', label: 'Home', description: 'Main landing page with product overview', icon: <Home size={20} /> },
      { screen: 'site-map', label: 'Site Map', description: 'Complete navigation of all pages', icon: <Map size={20} /> },
    ]
  },
  {
    title: "Authentication",
    description: "Login and account management",
    color: "#24186A",
    pages: [
      { screen: 'login', label: 'Login', description: 'Sign in to your account', icon: <LogIn size={20} /> },
      { screen: 'registration', label: 'Registration', description: 'Create a new account', icon: <UserPlus size={20} /> },
      { screen: 'forgot-password', label: 'Forgot Password', description: 'Reset your password', icon: <Key size={20} /> },
      { screen: 'role-selection', label: 'Role Selection', description: 'Choose your user role', icon: <Users size={20} /> },
    ]
  },
  {
    title: "Parent Dashboard",
    description: "Parent and guardian features",
    color: "#0B3C5D",
    pages: [
      { screen: 'unified-parent-dashboard', label: 'Parent Dashboard', description: 'Unified view for parents', icon: <Users size={20} /> },
      { screen: 'generate-exam', label: 'Generate Exam', description: 'Create new exams for children', icon: <ClipboardList size={20} /> },
      { screen: 'preview-blueprint', label: 'Preview Blueprint', description: 'Review exam blueprints', icon: <FileText size={20} /> },
      { screen: 'parent-lbi', label: 'LBI Insights', description: 'Behavioral intelligence reports', icon: <Brain size={20} /> },
      { screen: 'parent-consent-approve', label: 'Consent Approval', description: "Approve or reject child's assessment consent request", icon: <ShieldCheck size={20} /> },
    ]
  },
  {
    title: "Institute Dashboard",
    description: "School and institution features",
    color: "#0B3C5D",
    pages: [
      { screen: 'unified-institute-dashboard', label: 'Institute Dashboard', description: 'Unified view for institutions', icon: <Building2 size={20} /> },
      { screen: 'enrollment-requests', label: 'Enrollment Requests', description: 'Manage student enrollments', icon: <UserPlus size={20} /> },
      { screen: 'exam-templates', label: 'Exam Templates', description: 'Create and manage exam templates', icon: <FileText size={20} /> },
    ]
  },
  {
    title: "Student Portal",
    description: "Student exam and assessment features",
    color: "#4ECDC4",
    pages: [
      { screen: 'student-dashboard', label: 'Student Dashboard', description: 'Student home screen', icon: <GraduationCap size={20} /> },
      { screen: 'student-exam-list', label: 'Exam List', description: 'View pending and completed exams', icon: <ClipboardList size={20} /> },
      { screen: 'exam-player', label: 'Exam Player', description: 'Take an exam', icon: <Play size={20} /> },
      { screen: 'results-summary', label: 'Results Summary', description: 'View exam results', icon: <CheckCircle size={20} /> },
      { screen: 'student-competency', label: 'My Competency Profile', description: 'View personal competency scores, gaps and learning path recommendations', icon: <Target size={20} /> },
    ]
  },
  {
    title: "Behavioral Assessment",
    description: "LBI behavioral intelligence flow",
    color: "#DC2626",
    pages: [
      { screen: 'student-consent-explainer', label: 'Consent Explainer', description: 'DPDP Act consent information', icon: <Scale size={20} /> },
      { screen: 'assessment-start', label: 'Assessment Start', description: 'Begin behavioral assessment', icon: <Play size={20} /> },
      { screen: 'interactive-task', label: 'Interactive Task', description: 'Scenario-based questions', icon: <MessageSquare size={20} /> },
      { screen: 'context-transition', label: 'Context Transition', description: 'Module transitions', icon: <ArrowRight size={20} /> },
      { screen: 'focus-task', label: 'Focus Task', description: 'Attention and focus exercises', icon: <Target size={20} /> },
      { screen: 'reflection-screen', label: 'Reflection', description: 'Self-reflection questions', icon: <Lightbulb size={20} /> },
      { screen: 'session-recorded', label: 'Session Complete', description: 'Assessment completion summary', icon: <CheckCircle size={20} /> },
      { screen: 'lbi-assessment', label: 'LBI Assessment Player', description: 'Full LBI assessment experience', icon: <Brain size={20} /> },
    ]
  },
  {
    title: "CAPADEX — Behavioural Intelligence Engine",
    description: "4-stage AI-powered behavioural assessment — free Curiosity entry through paid Insight, Growth and Mastery",
    color: "#344E86",
    pages: [
      {
        label: 'Curiosity Stage (Free)',
        description: '10-question domain assessment — produces a structured Clarity Intelligence report with domain scores, detected patterns, emotional signals and priority focus areas',
        icon: <Brain size={20} />,
      },
      {
        label: 'Insight Stage',
        description: 'Root-cause pattern decode — competency gap analysis, trigger identification, personalised ranked action plan and longitudinal memory linking to the Curiosity profile',
        icon: <Lightbulb size={20} />,
      },
      {
        label: 'Growth Stage',
        description: '30-day personalised strategy — habit formation plan, stage-by-stage intervention map, milestone tracking and behavioural replacement roadmap',
        icon: <TrendingUp size={20} />,
      },
      {
        label: 'Mastery Stage',
        description: 'Full 19-domain behavioural profile — 1-on-1 expert debrief session, career or academic readiness intelligence map and complete OMEGA-X report',
        icon: <Award size={20} />,
      },
      {
        label: 'Pragati — Conversational Intelligence',
        description: '13-state FSM reflective conversation engine — concern recognition, behavioural mapping, pattern emergence, quality scoring and escalation intelligence',
        icon: <MessageSquare size={20} />,
      },
      {
        label: 'CAPADEX Package Selector',
        description: '4-tier nested package selection — Curiosity, Insight, Growth and Mastery bundles with persona-aware pricing and 15 % bundle discount',
        icon: <CreditCard size={20} />,
      },
      {
        screen: 'landing',
        label: 'Start Free Assessment →',
        description: 'Launch the CAPADEX Curiosity stage on the home page — free entry point to all four stages',
        icon: <Zap size={20} />,
      },
    ]
  },
  {
    title: "Products",
    description: "Assessment and AI product pages",
    color: "#0B3C5D",
    pages: [
      { screen: 'lbi-product', label: 'LBI\u2122', description: 'Learning Behavior Index product overview', icon: <Brain size={20} /> },
      { screen: 'intelligence-frameworks', label: 'Intelligence Frameworks', description: 'Psychometric and behavioural intelligence methodology overview', icon: <Network size={20} /> },
      { screen: 'mini-check', label: 'Mini Learning Check', description: 'Quick learning behavior snapshot', icon: <Sparkles size={20} /> },
      { screen: 'stress-check', label: 'Stress Check', description: 'Student stress and wellbeing assessment', icon: <Heart size={20} /> },
      { screen: 'ai-powered-reports', label: 'AI-Powered Reports', description: 'Personalized insights with AI recommendations', icon: <Cpu size={20} /> },
      { screen: 'metryxai-assistant', label: 'MetryxAI Assistant', description: '24/7 AI guidance for learning support', icon: <MessageSquare size={20} /> },
      { screen: 'pricing', label: 'Plans & Pricing', description: 'Platform plans and assessment packages', icon: <CreditCard size={20} /> },
      { screen: 'competitive-exam-portal', label: 'Competitive Exam Portal', description: 'JEE, NEET, UPSC and board exam practice hub', icon: <Swords size={20} /> },
    ]
  },
  {
    title: "ExamReadiness Index\u2122",
    description: "Behavioral exam readiness assessment",
    color: "#F59E0B",
    pages: [
      { screen: 'exam-ready', label: 'ExamReadiness Index\u2122 Home', description: 'Exam readiness assessment landing', icon: <Award size={20} /> },
      { screen: 'exam-ready-compare', label: 'Compare Plans', description: 'View assessment packages', icon: <Eye size={20} /> },
      { screen: 'exam-ready-login', label: 'ExamReadiness Index\u2122 Login', description: 'Sign in for assessment', icon: <LogIn size={20} /> },
      { screen: 'exam-ready-checkout', label: 'Checkout', description: 'Purchase assessment', icon: <CreditCard size={20} /> },
      { screen: 'exam-ready-assessment-start', label: 'Assessment Start', description: 'Begin readiness assessment', icon: <Play size={20} /> },
      { screen: 'exam-ready-assessment-start-all', label: 'Assessment Start (All)', description: 'Begin full suite readiness assessment', icon: <Play size={20} /> },
      { screen: 'exam-ready-assessment', label: 'Assessment', description: 'Take readiness assessment', icon: <BookOpen size={20} /> },
      { screen: 'exam-ready-report-status', label: 'Report Status', description: 'View report generation status', icon: <FileCheck size={20} /> },
      { screen: 'exam-ready-report-view', label: 'View Report', description: 'Access your readiness report', icon: <FileText size={20} /> },
      { screen: 'exam-ready-disclaimer', label: 'Disclaimer', description: 'Terms and conditions', icon: <Scale size={20} /> },
    ]
  },
  {
    title: "Solutions",
    description: "Industry-specific solutions",
    color: "#4ECDC4",
    pages: [
      { screen: 'k12-schools', label: 'K-12 Schools', description: 'Student wellbeing and learning insights for schools', icon: <School size={20} /> },
      { screen: 'coaching', label: 'Coaching Institutes', description: 'JEE/NEET/UPSC exam readiness optimization', icon: <Target size={20} /> },
      { screen: 'edtech', label: 'EdTech Platforms', description: 'API integration for learning platforms', icon: <Rocket size={20} /> },
      { screen: 'enterprise-hiring', label: 'Enterprise Hiring', description: 'Talent assessment for enterprise recruitment', icon: <Briefcase size={20} /> },
      { screen: 'campus-recruit', label: 'Campus Recruitment', description: 'University-to-workforce talent matching', icon: <GraduationCap size={20} /> },
      { screen: 'workforce-analytics', label: 'Workforce Analytics', description: 'Data-driven workforce intelligence', icon: <BarChart3 size={20} /> },
      { screen: 'employee-development', label: 'Employee Development', description: 'Continuous learning and growth tracking', icon: <Target size={20} /> },
      { screen: 'ld-integration', label: 'L&D Integration', description: 'Learning & development platform integration', icon: <Cpu size={20} /> },
    ]
  },
  {
    title: "Mentor Marketplace",
    description: "Expert mentors, tutors and counsellors",
    color: "#3B8C85",
    pages: [
      { screen: 'mentor-marketplace', label: 'Browse Mentors', description: 'Find expert tutors, counsellors and coaches', icon: <Search size={20} /> },
      { screen: 'mentor-profile', label: 'Mentor Profile', description: 'View mentor details and book sessions', icon: <Star size={20} /> },
      { screen: 'mentor-dashboard', label: 'Mentor Dashboard', description: 'Mentor session and earnings management', icon: <LayoutDashboard size={20} /> },
      { screen: 'join-session', label: 'Join Session', description: 'Enter a live video mentoring session', icon: <Video size={20} /> },
    ]
  },
  {
    title: "Mentor Onboarding",
    description: "Registration and verification flow for new mentors",
    color: "#3B8C85",
    pages: [
      { screen: 'onboarding-register', label: 'Mentor Registration', description: 'Sign up as a mentor on the platform', icon: <UserPlus size={20} /> },
      { screen: 'document-upload', label: 'Document Upload', description: 'Upload credentials and verification documents', icon: <Upload size={20} /> },
      { screen: 'mentor-agreement', label: 'Mentor Agreement', description: 'Review and sign the mentor agreement', icon: <FileSignature size={20} /> },
    ]
  },
  {
    title: "Learning Paths",
    description: "Career-based personalized roadmaps",
    color: "#4ECDC4",
    pages: [
      { screen: 'learning-paths', label: 'Explore Learning Paths', description: 'Career goal roadmaps with milestones and skills', icon: <Target size={20} /> },
    ]
  },
  {
    title: "Competency Intelligence",
    description: "Universal benchmarking, gap analysis and role-fit platform",
    color: "#0B3C5D",
    pages: [
      { screen: 'competency-intelligence', label: 'Competency Dashboard', description: 'Universal benchmarking across 50 competencies and 7 industries', icon: <Gauge size={20} /> },
      { screen: 'competency-gap-analysis', label: 'Gap Analysis & Role Fit', description: 'Prioritised competency gaps vs. industry cohort benchmarks', icon: <Target size={20} /> },
      { screen: 'competency-benchmarks', label: 'Industry Benchmarks', description: 'Percentile rankings across 7 industries for every competency', icon: <BarChart3 size={20} /> },
      { screen: 'competency-career-stages', label: 'Career Stage Analysis', description: 'Tailored scoring across Junior, Mid, Senior and Lead stages', icon: <TrendingUp size={20} /> },
      { screen: 'competency-role-transition', label: 'Role Transition Intelligence', description: 'Probability-scored readiness for your next career move', icon: <GitMerge size={20} /> },
      { screen: 'competency-hiring-prediction', label: 'Hiring Prediction Engine', description: 'Predict candidate success probability before the interview', icon: <UserCheck size={20} /> },
      { screen: 'competency-growth-simulation', label: 'Growth Simulation', description: 'Projected competency growth trajectory over 3–12 months', icon: <Rocket size={20} /> },
      { screen: 'competency-learning-paths', label: 'Personalised Learning Paths', description: 'Auto-generated interventions prioritised by gap severity', icon: <Lightbulb size={20} /> },
    ]
  },
  {
    title: "Adaptive Intelligence",
    description: "Ontology, benchmarking and adaptive career intelligence",
    color: "#344E86",
    pages: [
      { screen: 'ontology-explorer', label: 'Ontology Explorer', description: 'Explore the competency ontology and behavioural signal taxonomy', icon: <Network size={20} /> },
      { screen: 'scientific-competency', label: 'Scientific Competency Intelligence', description: 'Evidence-based competency measurement and scoring methodology', icon: <Beaker size={20} /> },
      { screen: 'benchmark-dashboard', label: 'Adaptive Benchmark Dashboard', description: 'Adaptive benchmarking across cohorts, roles and industries', icon: <BarChart3 size={20} /> },
      { screen: 'career-mobility', label: 'Career Mobility & Pathways', description: 'Career mobility and pathway intelligence across roles', icon: <GitMerge size={20} /> },
      { screen: 'trajectory-dashboard', label: 'Trajectory Dashboard', description: 'Longitudinal growth trajectory tracked over time', icon: <TrendingUp size={20} /> },
      { screen: 'adaptive-causal', label: 'Adaptive Causal Intelligence', description: 'Causal drivers behind behavioural and career outcomes', icon: <Cpu size={20} /> },
      { screen: 'market-intelligence', label: 'Market Intelligence', description: 'Labour-market demand signals and emerging skills trends', icon: <TrendingUp size={20} /> },
    ]
  },
  {
    title: "Enterprise & Workforce Intelligence",
    description: "Enterprise-scale workforce analytics and governance",
    color: "#0B3C5D",
    pages: [
      { screen: 'employer-dashboard', label: 'Employer Dashboard', description: 'Persona dashboard hosting workforce insights and Enterprise Workforce OS', icon: <Building2 size={20} /> },
      { screen: 'workforce-insights', label: 'Workforce Insights', description: 'Aggregate workforce behavioural analytics and intelligence', icon: <Users size={20} /> },
      { screen: 'workforce-os', label: 'Workforce OS', description: 'Operating system for workforce intelligence and planning', icon: <LayoutDashboard size={20} /> },
      { screen: 'enterprise-workforce-os', label: 'Enterprise Workforce OS', description: 'Enterprise-scale workforce operating system', icon: <Network size={20} /> },
      { screen: 'enterprise-intelligence', label: 'Enterprise Intelligence', description: 'Organisation-wide intelligence, reporting and insights', icon: <BarChart3 size={20} /> },
      { screen: 'governance-console', label: 'Governance Console', description: 'Data governance, RBAC and compliance controls', icon: <ShieldCheck size={20} /> },
      { screen: 'ai-governance', label: 'AI Governance', description: 'AI model governance and hallucination monitoring', icon: <ShieldCheck size={20} /> },
    ]
  },
  {
    title: "Career Builder Portal",
    description: "AI-powered career development tools for job seekers",
    color: "#4ECDC4",
    pages: [
      { screen: 'career-builder', label: 'Career Builder Portal', description: 'Full career development hub — EI gauge, resume studio, job tracker, interview prep, learning hub, mentors, goals', icon: <Briefcase size={20} /> },
      { screen: 'career-builder', label: 'Career Launchpad', description: 'Personalized starting hub for students, freshers and early-career users — readiness snapshot, quick actions and guided next steps', icon: <Rocket size={20} /> },
      { screen: 'career-discovery', label: 'Career Discovery', description: 'Explore career options and pathways matched to your strengths and interests', icon: <Compass size={20} /> },
    ]
  },
  {
    title: "Employer Portal",
    description: "Corporate hiring intelligence and talent management",
    color: "#0B3C5D",
    pages: [
      { screen: 'employer-portal', label: 'Employer Portal', description: 'Command center for hiring — job board, talent pipeline, candidates, MetryxOne assessments, interview hub, analytics', icon: <Building2 size={20} /> },
    ]
  },
  {
    title: "NGO Dashboard",
    description: "Social impact and beneficiary management",
    color: "#4ECDC4",
    pages: [
      { screen: 'ngo-dashboard', label: 'NGO Dashboard', description: 'Manage underprivileged children programs', icon: <Heart size={20} /> },
    ]
  },
  {
    title: "HR & Careers",
    description: "Human resources and job portal",
    color: "#0B3C5D",
    pages: [
      { screen: 'hr-dashboard', label: 'HR Dashboard', description: 'Manage jobs and recruitment', icon: <Building2 size={20} /> },
      { screen: 'careers', label: 'Careers Portal', description: 'Browse and apply for jobs', icon: <Award size={20} /> },
    ]
  },
  {
    title: "Super Admin",
    description: "Platform administration",
    color: "#0B3C5D",
    pages: [
      { screen: 'super-admin', label: 'Super Admin Portal', description: 'Platform-wide administration', icon: <Settings size={20} /> },
      { screen: 'admin-pricing', label: 'Pricing Admin', description: 'Manage CAPADEX stage pricing, packages and WhatsApp contacts', icon: <CreditCard size={20} /> },
      { screen: 'admin-competency', label: 'Competency Admin', description: 'Configure competency frameworks, domains and benchmarks', icon: <Gauge size={20} /> },
      { screen: 'admin-lbi', label: 'LBI Admin', description: 'Manage Learning Behaviour Index domains and assessment items', icon: <Brain size={20} /> },
      { screen: 'admin-sdi', label: 'SDI Admin', description: 'Manage Strength Deployment Inventory items and scoring', icon: <BarChart3 size={20} /> },
      { screen: 'interview-bank-admin', label: 'Interview Question Bank', description: 'Manage and curate the platform-wide interview question bank', icon: <ListChecks size={20} /> },
    ]
  },
  {
    title: "Company",
    description: "About MetryxOne and leadership",
    color: "#2A3F6E",
    pages: [
      { screen: 'about', label: 'About Us', description: 'Our mission, vision and team', icon: <Building2 size={20} /> },
      { screen: 'leadership', label: 'Leadership', description: 'Meet the leadership team', icon: <Users size={20} /> },
      { screen: 'press', label: 'Press & Media', description: 'News coverage and press releases', icon: <Newspaper size={20} /> },
    ]
  },
  {
    title: "Resources",
    description: "Documentation, research and learning",
    color: "#0B3C5D",
    pages: [
      { screen: 'docs', label: 'Documentation', description: 'Technical guides and API reference', icon: <BookOpen size={20} /> },
      { href: '/docs/MetryxOne_Platform_Documentation.md', label: 'Platform Docs', description: 'Full MetryxOne end-to-end platform documentation', icon: <FileText size={20} /> },
      { href: '/docs/CAPADEX_Documentation.md', label: 'CAPADEX Docs', description: 'Complete CAPADEX behavioral intelligence documentation', icon: <FileText size={20} /> },
      { screen: 'case-studies', label: 'Case Studies', description: 'Success stories from schools and parents', icon: <Award size={20} /> },
      { screen: 'research', label: 'Research Papers', description: 'Scientific methodology behind LBI', icon: <Beaker size={20} /> },
      { screen: 'help', label: 'Help Center', description: 'FAQs and troubleshooting guides', icon: <HelpCircle size={20} /> },
    ]
  },
  {
    title: "Legal & Support",
    description: "Terms, privacy and help",
    color: "#64748B",
    pages: [
      { screen: 'privacy', label: 'Privacy Policy', description: 'Data protection information', icon: <Scale size={20} /> },
      { screen: 'terms', label: 'Terms of Service', description: 'Usage terms and conditions', icon: <FileText size={20} /> },
      { screen: 'support', label: 'Support', description: 'Get help and assistance', icon: <MessageSquare size={20} /> },
      { screen: 'request-demo', label: 'Request Demo', description: 'Schedule a product demo', icon: <Play size={20} /> },
      { screen: 'contact', label: 'Contact Us', description: 'Get in touch with our team', icon: <Mail size={20} /> },
    ]
  },
  {
    title: "Career Seeker Portals",
    description: "Role-specific career development portals",
    color: "#4ECDC4",
    pages: [
      { screen: 'student-career-portal', label: 'Student Career Portal', description: 'Career insights, job matches and development tools for students', icon: <GraduationCap size={20} /> },
      { screen: 'parent-career-portal', label: 'Parent Career Portal', description: "Guide your child's career journey with AI-powered insights", icon: <Baby size={20} /> },
      { screen: 'institution-career-portal', label: 'Institution Career Portal', description: 'Track student placements and career outcomes at scale', icon: <Building2 size={20} /> },
      { screen: 'mentor-career-portal', label: 'Mentor Career Portal', description: 'Manage career coaching engagements and impact analytics', icon: <UserCheck size={20} /> },
    ]
  },
  {
    title: "Gamification",
    description: "Rewards, badges and leaderboards",
    color: "#F59E0B",
    pages: [
      { screen: 'gamification', label: 'Gamification Hub', description: 'Badges, streaks, leaderboards and reward milestones', icon: <Gamepad2 size={20} /> },
    ]
  },
  {
    title: "Settings",
    description: "Application settings and preferences",
    color: "#6B7280",
    pages: [
      { screen: 'theme-settings', label: 'Theme Settings', description: 'Customize appearance', icon: <Settings size={20} /> },
      { screen: 'notification-preferences', label: 'Notification Preferences', description: 'Manage alerts and email preferences', icon: <Mail size={20} /> },
    ]
  },
];

export function SiteMap({ onNavigate }: SiteMapProps) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--bg-secondary)" }}>
      <Navbar onNavigate={onNavigate} currentScreen="landing" />
      
      <main className="flex-1 pt-28 pb-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#24186A]/10 mb-4">
              <Map size={18} className="text-[#24186A]" />
              <span className="text-sm font-medium" style={{ color: "#24186A" }}>Navigation Map</span>
            </div>
            <h1 className="text-4xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
              Site Navigation
            </h1>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: "var(--text-secondary)" }}>
              Explore all pages in MetryxOne. Click any page to navigate directly without authentication.
            </p>
          </div>

          <div className="grid gap-8">
            {categories.map((category) => (
              <Card key={category.title} className="border border-[var(--border-subtle)] shadow-sm overflow-hidden">
                <CardHeader className="pb-4" style={{ borderLeft: `4px solid ${category.color}` }}>
                  <CardTitle className="flex items-center gap-3">
                    <span style={{ color: category.color }}>{category.title}</span>
                    <span className="text-sm font-normal" style={{ color: "var(--text-muted)" }}>
                      — {category.description}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {category.pages.map((page, idx) => (
                      page.href ? (
                        <a
                          key={`${page.href}-${idx}`}
                          href={page.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-auto p-4 flex flex-col items-start gap-2 text-left rounded-md border border-input bg-background hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/5 transition-all no-underline"
                          data-testid={`sitemap-link-${page.href}`}
                        >
                          <div className="flex items-center gap-2 w-full">
                            <div className="p-1.5 rounded-md" style={{ backgroundColor: `${category.color}15`, color: category.color }}>
                              {page.icon}
                            </div>
                            <span className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
                              {page.label}
                            </span>
                            <ExternalLink size={12} className="ml-auto shrink-0" style={{ color: category.color }} />
                          </div>
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {page.description}
                          </span>
                        </a>
                      ) : page.screen ? (
                      <Button
                        key={`${page.screen}-${idx}`}
                        variant="outline"
                        className="h-auto p-4 flex flex-col items-start gap-2 text-left hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/5 transition-all"
                        onClick={() => onNavigate(page.screen!)}
                        data-testid={`sitemap-link-${page.screen}`}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <div className="p-1.5 rounded-md" style={{ backgroundColor: `${category.color}15`, color: category.color }}>
                            {page.icon}
                          </div>
                          <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                            {page.label}
                          </span>
                        </div>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {page.description}
                        </span>
                      </Button>
                      ) : (
                        <div
                          key={`info-${idx}`}
                          className="h-auto p-4 flex flex-col items-start gap-2 text-left rounded-md border border-dashed"
                          style={{ borderColor: `${category.color}40`, backgroundColor: `${category.color}08` }}
                        >
                          <div className="flex items-center gap-2 w-full">
                            <div className="p-1.5 rounded-md" style={{ backgroundColor: `${category.color}15`, color: category.color }}>
                              {page.icon}
                            </div>
                            <span className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
                              {page.label}
                            </span>
                          </div>
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {page.description}
                          </span>
                        </div>
                      )
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
