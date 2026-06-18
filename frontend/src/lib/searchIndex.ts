import {
  Home, GraduationCap, Target, Brain, TrendingUp, Sparkles, Briefcase,
  Package, Handshake, Zap, FileText, BarChart3, CalendarDays, ClipboardList,
  MessageCircle, Users, Heart, Trophy, BookOpen, Shield, UserCheck,
  Activity, PieChart, UserPlus, Award, Map, HeartPulse,
  HelpCircle, Video, CheckCircle, BarChart2, Play, Building2,
  Search, BookMarked, Rocket, Globe, Layers, type LucideIcon,
} from 'lucide-react';

export type SearchRole = 'student' | 'parent' | 'institute' | 'hr';

export interface SearchItem {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  icon: LucideIcon;
  iconColor: string;
  roles: (SearchRole | 'all')[];
  category: 'navigation' | 'action' | 'feature' | 'help';
  badge?: string;
  action:
    | { type: 'navigate'; screen: string; data?: Record<string, unknown> }
    | { type: 'menuSelect'; item: string };
}

const P = '#344E86';
const T = '#4ECDC4';
const O = '#f97316';
const G = '#22c55e';
const V = '#8b5cf6';
const Y = '#d97706';
const R = '#ef4444';

export const SEARCH_INDEX: SearchItem[] = [

  /* ─── STUDENT: Navigation ─────────────────────────────── */
  {
    id: 'std-dashboard',
    title: 'Dashboard',
    description: 'Your home — live XP bar, upcoming exams, quick access cards and performance overview.',
    keywords: ['home', 'overview', 'main', 'start', 'xp', 'profile', 'level'],
    icon: Home, iconColor: P, roles: ['student'], category: 'navigation',
    action: { type: 'menuSelect', item: 'dashboard' },
  },
  {
    id: 'std-missions',
    title: 'Daily Missions',
    description: 'Complete 3 tasks every day to earn XP and coins. Missions reset at midnight.',
    keywords: ['mission', 'daily', 'task', 'xp', 'coins', 'reward', 'earn', 'streak'],
    icon: Zap, iconColor: O, roles: ['student'], category: 'navigation', badge: 'new',
    action: { type: 'menuSelect', item: 'missions' },
  },
  {
    id: 'std-exams',
    title: 'My Exams',
    description: 'Browse all available tests, take practice exams, and view your submitted results.',
    keywords: ['exam', 'test', 'quiz', 'assessment', 'mcq', 'practice', 'attempt', 'score'],
    icon: FileText, iconColor: P, roles: ['student'], category: 'navigation',
    action: { type: 'menuSelect', item: 'exams' },
  },
  {
    id: 'std-progress',
    title: 'My Progress',
    description: 'Detailed subject-wise performance, score trends and LBI completion status.',
    keywords: ['progress', 'performance', 'score', 'analytics', 'trend', 'improvement', 'subject'],
    icon: BarChart3, iconColor: P, roles: ['student'], category: 'navigation',
    action: { type: 'menuSelect', item: 'progress' },
  },
  {
    id: 'std-analytics',
    title: 'Exam Analytics',
    description: 'Charts and graphs showing score trends, subject radar and peer benchmarks.',
    keywords: ['analytics', 'chart', 'graph', 'trend', 'radar', 'benchmark', 'data', 'stats'],
    icon: TrendingUp, iconColor: P, roles: ['student'], category: 'navigation',
    action: { type: 'menuSelect', item: 'analytics' },
  },
  {
    id: 'std-lbi',
    title: 'LBI Assessment',
    description: '7-domain behavioral intelligence assessment. Unlock your cognitive profile.',
    keywords: ['lbi', 'behavioral', 'behaviour', 'intelligence', 'assessment', 'cognitive', 'profile', 'domains', 'personality'],
    icon: Brain, iconColor: T, roles: ['student'], category: 'navigation', badge: 'core',
    action: { type: 'menuSelect', item: 'lbi' },
  },
  {
    id: 'std-exam-ready',
    title: 'Exam Readiness',
    description: 'AI-predicted readiness score for each upcoming exam based on your study data.',
    keywords: ['exam ready', 'readiness', 'prediction', 'ai', 'preparation', 'score', 'upcoming', 'board exam'],
    icon: Target, iconColor: T, roles: ['student'], category: 'navigation', badge: 'new',
    action: { type: 'menuSelect', item: 'exam-ready' },
  },
  {
    id: 'std-study-planner',
    title: 'Study Planner',
    description: 'Create daily study schedules tied to subjects and exam dates. Stay on track.',
    keywords: ['study', 'planner', 'schedule', 'plan', 'calendar', 'revision', 'timetable', 'tasks'],
    icon: CalendarDays, iconColor: V, roles: ['student'], category: 'navigation',
    action: { type: 'menuSelect', item: 'study-planner' },
  },
  {
    id: 'std-assignments',
    title: 'Assignments',
    description: 'School-assigned tasks, practice papers and supervised sessions. Track deadlines.',
    keywords: ['assignment', 'homework', 'task', 'deadline', 'school', 'session', 'teacher', 'submit'],
    icon: ClipboardList, iconColor: O, roles: ['student'], category: 'navigation',
    action: { type: 'menuSelect', item: 'assignments' },
  },
  {
    id: 'std-forum',
    title: 'Learning Forum',
    description: 'Ask questions, share notes and get answers from peers and mentors.',
    keywords: ['forum', 'community', 'question', 'ask', 'help', 'peer', 'discussion', 'notes', 'share'],
    icon: MessageCircle, iconColor: T, roles: ['student'], category: 'navigation', badge: 'new',
    action: { type: 'menuSelect', item: 'forum' },
  },
  {
    id: 'std-collab',
    title: 'Collab Hub',
    description: 'Study with peers in real-time collaboration sessions. Share resources.',
    keywords: ['collab', 'collaborate', 'group', 'peer', 'study group', 'real-time', 'together', 'team'],
    icon: Users, iconColor: T, roles: ['student'], category: 'navigation',
    action: { type: 'menuSelect', item: 'collab' },
  },
  {
    id: 'std-wellness',
    title: 'Wellness Hub',
    description: 'Daily mood and energy check-in. Track burnout risk and emotional patterns.',
    keywords: ['wellness', 'mood', 'mental health', 'burnout', 'stress', 'energy', 'emotion', 'check-in', 'wellbeing'],
    icon: HeartPulse, iconColor: G, roles: ['student'], category: 'navigation',
    action: { type: 'menuSelect', item: 'wellness' },
  },
  {
    id: 'std-rewards',
    title: 'XP & Rewards',
    description: 'Redeem earned coins for gift cards, course passes and mentorship sessions.',
    keywords: ['rewards', 'xp', 'coins', 'redeem', 'gift', 'shop', 'points', 'level', 'gamification'],
    icon: Trophy, iconColor: Y, roles: ['student'], category: 'navigation', badge: 'new',
    action: { type: 'menuSelect', item: 'rewards' },
  },
  {
    id: 'std-career',
    title: 'Career Intelligence',
    description: 'AI-matched career paths based on your LBI profile. Explore 160+ careers.',
    keywords: ['career', 'job', 'future', 'profession', 'path', 'ai', 'match', 'intelligence', 'guidance'],
    icon: Briefcase, iconColor: P, roles: ['student'], category: 'navigation', badge: 'new',
    action: { type: 'menuSelect', item: 'career' },
  },
  {
    id: 'std-ai-reports',
    title: 'AI Reports',
    description: 'Personalized AI-generated insights about your performance and learning patterns.',
    keywords: ['ai', 'report', 'insight', 'smart', 'generated', 'analysis', 'personalized', 'recommendation'],
    icon: Sparkles, iconColor: T, roles: ['student'], category: 'navigation',
    action: { type: 'menuSelect', item: 'ai-reports' },
  },
  {
    id: 'std-mentor',
    title: 'Mentor Services',
    description: 'Book 1-on-1 or group video sessions with AI-matched mentors.',
    keywords: ['mentor', 'session', 'book', 'tutor', '1-on-1', 'video', 'coaching', 'guidance', 'expert'],
    icon: Handshake, iconColor: P, roles: ['student'], category: 'navigation',
    action: { type: 'menuSelect', item: 'mentor-services' },
  },
  {
    id: 'std-packages',
    title: 'My Packages',
    description: 'View and manage your subscription plans and LBI assessment packages.',
    keywords: ['package', 'plan', 'subscription', 'purchase', 'upgrade', 'bundle', 'billing'],
    icon: Package, iconColor: P, roles: ['student'], category: 'navigation',
    action: { type: 'menuSelect', item: 'packages' },
  },
  {
    id: 'std-education',
    title: 'Education Planner',
    description: 'Plan your academic roadmap — board, grade, subjects and future goals.',
    keywords: ['education', 'board', 'cbse', 'icse', 'grade', 'curriculum', 'subjects', 'school', 'plan'],
    icon: GraduationCap, iconColor: P, roles: ['student'], category: 'navigation',
    action: { type: 'menuSelect', item: 'education' },
  },

  /* ─── STUDENT: Features / Actions ────────────────────── */
  {
    id: 'std-take-exam',
    title: 'Take an Exam',
    description: 'Browse available tests and start a new exam attempt right now.',
    keywords: ['take exam', 'start exam', 'attempt', 'quiz', 'test now', 'begin', 'practice'],
    icon: Play, iconColor: G, roles: ['student'], category: 'action',
    action: { type: 'menuSelect', item: 'exams' },
  },
  {
    id: 'std-earn-xp',
    title: 'Earn XP Today',
    description: 'Complete your 3 daily missions to maximize XP and coins earned today.',
    keywords: ['earn xp', 'points', 'today', 'daily', 'coins', 'mission', 'boost', 'level up'],
    icon: Zap, iconColor: O, roles: ['student'], category: 'action',
    action: { type: 'menuSelect', item: 'missions' },
  },
  {
    id: 'std-check-readiness',
    title: 'Check Exam Readiness',
    description: 'See your AI-predicted readiness score for each upcoming exam.',
    keywords: ['readiness', 'ready', 'prepared', 'upcoming exam', 'prediction', 'percentage'],
    icon: Target, iconColor: T, roles: ['student'], category: 'action',
    action: { type: 'menuSelect', item: 'exam-ready' },
  },
  {
    id: 'std-start-lbi',
    title: 'Start LBI Assessment',
    description: 'Begin or continue your 7-domain behavioral intelligence assessment.',
    keywords: ['start lbi', 'begin assessment', 'take lbi', 'behavioral test', 'personality', 'cognitive'],
    icon: Brain, iconColor: T, roles: ['student'], category: 'action',
    action: { type: 'menuSelect', item: 'lbi' },
  },
  {
    id: 'std-daily-checkin',
    title: 'Daily Wellness Check-in',
    description: 'Log your mood and energy level — takes under 30 seconds.',
    keywords: ['checkin', 'check-in', 'mood', 'energy', 'today', 'wellness', 'daily', 'log'],
    icon: Heart, iconColor: G, roles: ['student'], category: 'action',
    action: { type: 'menuSelect', item: 'wellness' },
  },
  {
    id: 'std-explore-careers',
    title: 'Explore Career Matches',
    description: 'Discover careers you are naturally wired for based on your LBI profile.',
    keywords: ['careers', 'explore', 'future', 'wired', 'match', 'profession', 'what should i be'],
    icon: Briefcase, iconColor: P, roles: ['student'], category: 'action',
    action: { type: 'menuSelect', item: 'career' },
  },
  {
    id: 'std-plan-study',
    title: 'Plan Study Sessions',
    description: 'Add new study tasks to your planner tied to upcoming exam dates.',
    keywords: ['plan', 'schedule', 'add task', 'revision', 'study session', 'calendar'],
    icon: CalendarDays, iconColor: V, roles: ['student'], category: 'action',
    action: { type: 'menuSelect', item: 'study-planner' },
  },
  {
    id: 'std-redeem-coins',
    title: 'Redeem Coins',
    description: 'Exchange your earned coins for gift cards, passes or mentorship.',
    keywords: ['redeem', 'coins', 'gift card', 'exchange', 'shop', 'spend', 'reward store'],
    icon: Award, iconColor: Y, roles: ['student'], category: 'action',
    action: { type: 'menuSelect', item: 'rewards' },
  },
  {
    id: 'std-book-mentor',
    title: 'Book a Mentor Session',
    description: 'Schedule a 1-on-1 or group video call with an AI-matched mentor.',
    keywords: ['book', 'mentor', 'session', 'tutor', 'video call', 'schedule', 'appointment'],
    icon: Video, iconColor: P, roles: ['student'], category: 'action',
    action: { type: 'menuSelect', item: 'mentor-services' },
  },
  {
    id: 'std-view-score',
    title: 'View My Scores',
    description: 'See your latest exam scores, subject averages and improvement trends.',
    keywords: ['scores', 'marks', 'results', 'grades', 'average', 'performance', 'see results'],
    icon: BarChart3, iconColor: P, roles: ['student'], category: 'action',
    action: { type: 'menuSelect', item: 'progress' },
  },

  /* ─── PARENT: Navigation ──────────────────────────────── */
  {
    id: 'par-dashboard',
    title: 'Parent Dashboard',
    description: 'Home overview with child alerts, weekly digest and quick actions.',
    keywords: ['home', 'overview', 'parent', 'child', 'alerts', 'digest', 'summary'],
    icon: Home, iconColor: P, roles: ['parent'], category: 'navigation',
    action: { type: 'menuSelect', item: 'dashboard' },
  },
  {
    id: 'par-education',
    title: 'Education Planner',
    description: "Set your child's board, grade, subjects and long-term academic roadmap.",
    keywords: ['education', 'board', 'grade', 'curriculum', 'cbse', 'icse', 'ib', 'subjects', 'school'],
    icon: GraduationCap, iconColor: P, roles: ['parent'], category: 'navigation',
    action: { type: 'menuSelect', item: 'education' },
  },
  {
    id: 'par-exam-ready',
    title: 'Exam Readiness',
    description: "See your child's AI-predicted readiness score for upcoming exams.",
    keywords: ['exam readiness', 'prepared', 'prediction', 'upcoming exam', 'ai', 'score'],
    icon: Target, iconColor: T, roles: ['parent'], category: 'navigation', badge: 'new',
    action: { type: 'menuSelect', item: 'exam-ready' },
  },
  {
    id: 'par-lbi',
    title: 'LBI Assessment',
    description: "Grant consent and track your child's 19-domain behavioral intelligence report.",
    keywords: ['lbi', 'behavioral', 'behaviour', 'report', 'consent', 'cognitive', 'emotional', 'domains'],
    icon: Brain, iconColor: T, roles: ['parent'], category: 'navigation', badge: 'core',
    action: { type: 'menuSelect', item: 'lbi-product' },
  },
  {
    id: 'par-exam-trends',
    title: 'Exam Analytics',
    description: "Score trends, subject breakdown and peer benchmarks for your child.",
    keywords: ['analytics', 'trend', 'chart', 'score', 'performance', 'subject', 'benchmark', 'peer'],
    icon: TrendingUp, iconColor: P, roles: ['parent'], category: 'navigation',
    action: { type: 'menuSelect', item: 'exam-trends' },
  },
  {
    id: 'par-ai-reports',
    title: 'AI Reports',
    description: 'AI-generated insights about your child performance and behavioral data.',
    keywords: ['ai', 'report', 'smart', 'generated', 'insight', 'analysis', 'personalized'],
    icon: Sparkles, iconColor: T, roles: ['parent'], category: 'navigation',
    action: { type: 'menuSelect', item: 'ai-powered-reports' },
  },
  {
    id: 'par-metryxai',
    title: 'MetryxAI Assistant',
    description: 'Ask questions about your child academic and behavioral data using AI.',
    keywords: ['metryxai', 'ai', 'ask', 'chat', 'assistant', 'question', 'help', 'bot'],
    icon: MessageCircle, iconColor: T, roles: ['parent'], category: 'navigation',
    action: { type: 'menuSelect', item: 'metryxai-assistant' },
  },
  {
    id: 'par-packages',
    title: 'My Packages',
    description: 'Purchase and manage LBI assessment packages for your child.',
    keywords: ['package', 'plan', 'subscription', 'purchase', 'buy', 'bundle', 'lbi package'],
    icon: Package, iconColor: P, roles: ['parent'], category: 'navigation',
    action: { type: 'menuSelect', item: 'my-packages' },
  },
  {
    id: 'par-mentor',
    title: 'Mentor Services',
    description: 'Book video sessions with AI-matched mentors for your child.',
    keywords: ['mentor', 'tutor', 'book', 'session', 'video', 'coaching', '1-on-1', 'group study'],
    icon: Handshake, iconColor: P, roles: ['parent'], category: 'navigation',
    action: { type: 'menuSelect', item: 'enterprise-hub' },
  },

  /* ─── PARENT: Actions ─────────────────────────────────── */
  {
    id: 'par-grant-consent',
    title: 'Grant LBI Consent',
    description: 'Authorize your child to take the LBI behavioral assessment.',
    keywords: ['consent', 'authorize', 'grant', 'permission', 'lbi', 'approve', 'allow'],
    icon: UserCheck, iconColor: T, roles: ['parent'], category: 'action',
    action: { type: 'menuSelect', item: 'lbi-product' },
  },
  {
    id: 'par-book-mentor',
    title: 'Book Mentor for Child',
    description: 'Schedule a 1-on-1 or group mentoring session for your child.',
    keywords: ['book', 'mentor', 'child', 'session', 'tutor', 'video call', 'appointment'],
    icon: Video, iconColor: P, roles: ['parent'], category: 'action',
    action: { type: 'menuSelect', item: 'enterprise-hub' },
  },
  {
    id: 'par-check-scores',
    title: "Check Child's Scores",
    description: "View your child's latest exam results and score trends.",
    keywords: ['check', 'scores', 'results', 'performance', 'marks', 'grades', 'child'],
    icon: BarChart3, iconColor: P, roles: ['parent'], category: 'action',
    action: { type: 'menuSelect', item: 'exam-trends' },
  },
  {
    id: 'par-view-lbi',
    title: 'View Behavioral Report',
    description: "Open your child's full LBI behavioral intelligence report.",
    keywords: ['view', 'report', 'behavioral', 'lbi', 'cognitive', 'domains', 'profile'],
    icon: Brain, iconColor: T, roles: ['parent'], category: 'action',
    action: { type: 'menuSelect', item: 'lbi-product' },
  },

  /* ─── INSTITUTE: Navigation ───────────────────────────── */
  {
    id: 'inst-overview',
    title: 'School Overview',
    description: 'Key stats — total students, active exams, pending enrollments and batch counts.',
    keywords: ['overview', 'dashboard', 'stats', 'summary', 'school', 'home', 'metrics'],
    icon: Home, iconColor: P, roles: ['institute'], category: 'navigation',
    action: { type: 'menuSelect', item: 'overview' },
  },
  {
    id: 'inst-students',
    title: 'Student Management',
    description: 'Add, import and manage student profiles with DPDP compliance.',
    keywords: ['students', 'add student', 'import', 'manage', 'profile', 'enroll', 'csv', 'bulk'],
    icon: Users, iconColor: P, roles: ['institute'], category: 'navigation',
    action: { type: 'menuSelect', item: 'students' },
  },
  {
    id: 'inst-exams',
    title: 'Exam Builder',
    description: 'Create MCQ exams, manage question banks and set auto-grading rules.',
    keywords: ['exam', 'create', 'build', 'mcq', 'question', 'bank', 'grading', 'auto', 'test'],
    icon: FileText, iconColor: P, roles: ['institute'], category: 'navigation',
    action: { type: 'menuSelect', item: 'exams' },
  },
  {
    id: 'inst-reports',
    title: 'Reports & Analytics',
    description: 'Class-level performance, at-risk students and subject heatmaps.',
    keywords: ['reports', 'analytics', 'performance', 'at-risk', 'heatmap', 'export', 'pdf', 'csv'],
    icon: BarChart3, iconColor: P, roles: ['institute'], category: 'navigation',
    action: { type: 'menuSelect', item: 'reports' },
  },
  {
    id: 'inst-lbi',
    title: 'LBI Assessment (Class)',
    description: 'View cohort-level LBI behavioral profiles and assign assessments to batches.',
    keywords: ['lbi', 'behavioral', 'cohort', 'class', 'batch', 'assign', 'assessment', 'profile'],
    icon: Brain, iconColor: T, roles: ['institute'], category: 'navigation', badge: 'core',
    action: { type: 'menuSelect', item: 'lbi-product' },
  },
  {
    id: 'inst-exam-ready',
    title: 'Exam Readiness Index',
    description: 'AI-predicted readiness scores for all students before upcoming exams.',
    keywords: ['readiness', 'prediction', 'ai', 'prepared', 'upcoming', 'student readiness'],
    icon: Target, iconColor: T, roles: ['institute'], category: 'navigation', badge: 'new',
    action: { type: 'menuSelect', item: 'exam-ready' },
  },
  {
    id: 'inst-ai-reports',
    title: 'AI Reports',
    description: 'AI-generated class and individual academic insight reports.',
    keywords: ['ai', 'report', 'generated', 'insight', 'class', 'individual', 'smart'],
    icon: Sparkles, iconColor: T, roles: ['institute'], category: 'navigation',
    action: { type: 'menuSelect', item: 'ai-powered-reports' },
  },
  {
    id: 'inst-metryxai',
    title: 'Ask MetryxAI',
    description: 'AI assistant for answering questions about class performance and data.',
    keywords: ['metryxai', 'ai', 'ask', 'chat', 'assistant', 'question', 'school', 'data'],
    icon: MessageCircle, iconColor: T, roles: ['institute'], category: 'navigation',
    action: { type: 'menuSelect', item: 'metryxai-assistant' },
  },
  {
    id: 'inst-education',
    title: 'Education Plans',
    description: 'Curriculum mapping and academic planning for the institution.',
    keywords: ['education', 'curriculum', 'plan', 'academic', 'board', 'subjects', 'mapping'],
    icon: BookOpen, iconColor: P, roles: ['institute'], category: 'navigation',
    action: { type: 'menuSelect', item: 'education' },
  },

  /* ─── INSTITUTE: Actions ──────────────────────────────── */
  {
    id: 'inst-add-student',
    title: 'Add a Student',
    description: 'Add a new student to your institute and assign them to a batch.',
    keywords: ['add', 'student', 'new', 'register', 'enroll', 'create profile'],
    icon: UserPlus, iconColor: G, roles: ['institute'], category: 'action',
    action: { type: 'menuSelect', item: 'students' },
  },
  {
    id: 'inst-create-exam',
    title: 'Create a New Exam',
    description: 'Build a new MCQ exam with questions, time limits and auto-grading.',
    keywords: ['create exam', 'new exam', 'build', 'draft', 'mcq', 'question', 'add exam'],
    icon: FileText, iconColor: P, roles: ['institute'], category: 'action',
    action: { type: 'menuSelect', item: 'exams' },
  },
  {
    id: 'inst-view-analytics',
    title: 'View Class Analytics',
    description: 'See performance charts, at-risk students and subject heatmaps.',
    keywords: ['analytics', 'class performance', 'charts', 'at-risk', 'weak students'],
    icon: PieChart, iconColor: P, roles: ['institute'], category: 'action',
    action: { type: 'menuSelect', item: 'reports' },
  },
  {
    id: 'inst-export-report',
    title: 'Export Report',
    description: 'Generate PDF or CSV report for class, batch or school-wide performance.',
    keywords: ['export', 'pdf', 'csv', 'download', 'report', 'generate', 'share'],
    icon: BarChart2, iconColor: P, roles: ['institute'], category: 'action',
    action: { type: 'menuSelect', item: 'reports' },
  },

  /* ─── HR: Navigation ──────────────────────────────────── */
  {
    id: 'hr-overview',
    title: 'HR Overview',
    description: 'High-level HR metrics — jobs, applications, pending approvals and mentor stats.',
    keywords: ['overview', 'home', 'hr', 'summary', 'metrics', 'dashboard', 'stats'],
    icon: Home, iconColor: P, roles: ['hr'], category: 'navigation',
    action: { type: 'menuSelect', item: 'overview' },
  },
  {
    id: 'hr-jobs',
    title: 'Job Postings',
    description: 'Create and manage open positions through the full approval workflow.',
    keywords: ['job', 'posting', 'open role', 'position', 'publish', 'draft', 'vacancy'],
    icon: Briefcase, iconColor: P, roles: ['hr'], category: 'navigation',
    action: { type: 'menuSelect', item: 'jobs' },
  },
  {
    id: 'hr-approvals',
    title: 'Approvals',
    description: 'Multi-step approval queue for job postings and mentor applications.',
    keywords: ['approvals', 'pending', 'review', 'approve', 'reject', 'workflow', 'sign-off'],
    icon: UserCheck, iconColor: O, roles: ['hr'], category: 'navigation',
    action: { type: 'menuSelect', item: 'approvals' },
  },
  {
    id: 'hr-mentors',
    title: 'Mentor Management',
    description: 'Active mentor roster with session scores, at-risk flags and performance health.',
    keywords: ['mentor', 'roster', 'active', 'performance', 'at-risk', 'session', 'phi', 'quality'],
    icon: Users, iconColor: P, roles: ['hr'], category: 'navigation',
    action: { type: 'menuSelect', item: 'mentors' },
  },
  {
    id: 'hr-compliance',
    title: 'Compliance',
    description: 'Track policy violations, payout approvals and audit records.',
    keywords: ['compliance', 'violation', 'policy', 'audit', 'payout', 'legal', 'record'],
    icon: Shield, iconColor: R, roles: ['hr'], category: 'navigation',
    action: { type: 'menuSelect', item: 'compliance' },
  },
  {
    id: 'hr-behavioral',
    title: 'Behavioral Hiring',
    description: 'AI-matches candidates LBI profiles to role competency requirements.',
    keywords: ['behavioral hiring', 'lbi', 'candidate', 'competency', 'ai match', 'fit score', 'screening'],
    icon: Brain, iconColor: T, roles: ['hr'], category: 'navigation',
    action: { type: 'menuSelect', item: 'behavioral-hiring' },
  },

  /* ─── HR: Actions ─────────────────────────────────────── */
  {
    id: 'hr-create-job',
    title: 'Create Job Posting',
    description: 'Draft a new job posting and submit it for approval.',
    keywords: ['create job', 'new posting', 'draft', 'vacancy', 'hire', 'open role'],
    icon: Briefcase, iconColor: P, roles: ['hr'], category: 'action',
    action: { type: 'menuSelect', item: 'jobs' },
  },
  {
    id: 'hr-clear-approvals',
    title: 'Clear Pending Approvals',
    description: 'Review and approve or reject pending job and mentor applications.',
    keywords: ['pending', 'approve', 'reject', 'clear', 'queue', 'review', 'sign off'],
    icon: CheckCircle, iconColor: G, roles: ['hr'], category: 'action',
    action: { type: 'menuSelect', item: 'approvals' },
  },
  {
    id: 'hr-check-mentors',
    title: 'Check At-Risk Mentors',
    description: 'Identify mentors with declining performance before it becomes critical.',
    keywords: ['at-risk', 'mentor', 'performance', 'declining', 'flag', 'warning', 'phi'],
    icon: Activity, iconColor: R, roles: ['hr'], category: 'action',
    action: { type: 'menuSelect', item: 'mentors' },
  },

  /* ─── Universal: Features ─────────────────────────────── */
  {
    id: 'all-quick-tour',
    title: 'Quick Tour',
    description: 'Take a guided walkthrough of your dashboard and all its features.',
    keywords: ['tour', 'guide', 'walkthrough', 'help', 'tutorial', 'how to', 'learn', 'onboarding'],
    icon: Map, iconColor: T, roles: ['student', 'parent', 'institute', 'hr'], category: 'help',
    action: { type: 'navigate', screen: '__quick-tour' },
  },
  {
    id: 'all-home',
    title: 'Landing Page',
    description: 'Go back to the MetryxOne home / marketing page.',
    keywords: ['home', 'landing', 'main page', 'back', 'start'],
    icon: Home, iconColor: P, roles: ['student', 'parent', 'institute', 'hr'], category: 'navigation',
    action: { type: 'navigate', screen: 'landing' },
  },
  {
    id: 'all-lbi-platform',
    title: 'LBI Platform',
    description: 'The Learning Behaviour Insights assessment platform — 19 cognitive domains.',
    keywords: ['lbi', 'learning behaviour', 'behavioral intelligence', 'domains', 'platform', 'assessment'],
    icon: Brain, iconColor: T, roles: ['student', 'parent', 'institute', 'hr'], category: 'feature',
    action: { type: 'navigate', screen: 'lbi-assessment' },
  },
  {
    id: 'all-exam-ready-platform',
    title: 'Exam Ready Platform',
    description: 'AI-powered exam preparation and readiness scoring system.',
    keywords: ['exam ready', 'preparation', 'readiness', 'platform', 'ai', 'board exam', 'cbse', 'competitive'],
    icon: Target, iconColor: T, roles: ['student', 'parent', 'institute', 'hr'], category: 'feature',
    action: { type: 'navigate', screen: 'exam-ready' },
  },
  {
    id: 'all-career-builder',
    title: 'Career Builder',
    description: 'Build a personalized career roadmap using LBI data and AI matching.',
    keywords: ['career', 'builder', 'roadmap', 'future', 'profession', 'guidance', 'path'],
    icon: Briefcase, iconColor: P, roles: ['student', 'parent', 'institute', 'hr'], category: 'feature',
    action: { type: 'navigate', screen: 'career-builder' },
  },
  {
    id: 'all-mentor-marketplace',
    title: 'Mentor Marketplace',
    description: 'Browse and book sessions with expert mentors across all subjects.',
    keywords: ['mentor', 'marketplace', 'browse', 'book', 'expert', 'tutor', 'subject', 'find'],
    icon: Handshake, iconColor: P, roles: ['student', 'parent', 'institute', 'hr'], category: 'feature',
    action: { type: 'navigate', screen: 'mentor-marketplace' },
  },
  {
    id: 'all-gamification',
    title: 'Gamification System',
    description: 'XP, levels, streaks, coins and reward redemption for students.',
    keywords: ['gamification', 'xp', 'levels', 'streak', 'coins', 'rewards', 'badges', 'points'],
    icon: Trophy, iconColor: Y, roles: ['student', 'parent', 'institute', 'hr'], category: 'feature',
    action: { type: 'navigate', screen: 'gamification' },
  },
  {
    id: 'all-docs',
    title: 'Documentation / Docs',
    description: 'Platform guides, API reference and help articles.',
    keywords: ['docs', 'documentation', 'help', 'guide', 'reference', 'manual', 'api', 'how to'],
    icon: HelpCircle, iconColor: P, roles: ['student', 'parent', 'institute', 'hr'], category: 'help',
    action: { type: 'navigate', screen: 'docs' },
  },
  {
    id: 'all-privacy',
    title: 'Privacy Policy',
    description: 'How MetryxOne collects, uses and protects your data.',
    keywords: ['privacy', 'policy', 'data', 'dpdp', 'ferpa', 'gdpr', 'security', 'protection'],
    icon: Shield, iconColor: P, roles: ['student', 'parent', 'institute', 'hr'], category: 'help',
    action: { type: 'navigate', screen: 'privacy' },
  },

  /* ─── Competitive Exam Portal ──────────────────────────── */
  {
    id: 'all-exam-portal',
    title: 'Competitive Exam Portal',
    description: 'JEE, NEET, EAMCET, CAT, CUET & GATE prep hub — benchmarks, gap analysis and mock tests.',
    keywords: ['jee', 'neet', 'eamcet', 'cat', 'cuet', 'gate', 'competitive', 'exam', 'portal', 'entrance', 'engineering', 'medical', 'mba', 'study plan', 'mock test', 'rank', 'percentile'],
    icon: GraduationCap, iconColor: '#4ECDC4', roles: ['student', 'parent', 'institute', 'hr'], category: 'navigation',
    action: { type: 'navigate', screen: 'competitive-exam-portal' },
  },
  {
    id: 'std-exam-portal-mock',
    title: 'Mock Tests (JEE / NEET / CAT)',
    description: 'Take full-length timed mock tests and see your predicted rank after each attempt.',
    keywords: ['mock test', 'full length', 'jee mock', 'neet mock', 'practice exam', 'timed test', 'rank predictor', 'percentile'],
    icon: FileText, iconColor: '#4ECDC4', roles: ['student'], category: 'feature',
    action: { type: 'navigate', screen: 'competitive-exam-portal' },
  },
  {
    id: 'std-exam-portal-gap',
    title: 'Gap Analysis (Exam Prep)',
    description: 'Identify weak chapters and topics across JEE, NEET, CAT and other exam tracks.',
    keywords: ['gap analysis', 'weak chapters', 'topics', 'jee gap', 'neet gap', 'exam preparation', 'chapter progress', 'confidence'],
    icon: BarChart3, iconColor: '#0B3C5D', roles: ['student'], category: 'feature',
    action: { type: 'navigate', screen: 'competitive-exam-portal' },
  },
  {
    id: 'std-exam-portal-collab',
    title: 'Study Groups (Exam)',
    description: 'Join or create collaborative study groups for JEE, NEET, CAT and other exams.',
    keywords: ['study group', 'collaborate', 'collab', 'group study', 'peer', 'jee group', 'neet group', 'community'],
    icon: Users, iconColor: '#4ECDC4', roles: ['student'], category: 'feature',
    action: { type: 'navigate', screen: 'competitive-exam-portal' },
  },
  {
    id: 'std-exam-portal-mentors',
    title: 'Exam Mentors',
    description: 'Get matched with subject-specific mentors who are IIT/AIIMS alumni.',
    keywords: ['mentor', 'iit', 'aiims', 'exam mentor', 'subject mentor', 'coaching', 'guidance', 'expert'],
    icon: Handshake, iconColor: '#0B3C5D', roles: ['student'], category: 'feature',
    action: { type: 'navigate', screen: 'competitive-exam-portal' },
  },

  /* ─── Interview Question Bank ──────────────────────────── */
  {
    id: 'all-interview-bank',
    title: 'Interview Question Bank',
    description: 'Browse curated interview questions by category, difficulty and industry.',
    keywords: ['interview', 'question', 'bank', 'practice', 'coding', 'hr interview', 'technical', 'aptitude', 'placement'],
    icon: BookMarked, iconColor: '#344E86', roles: ['student', 'parent', 'institute', 'hr'], category: 'navigation',
    action: { type: 'navigate', screen: 'interview-bank-admin' },
  },

  /* ─── Employer Portal ──────────────────────────────────── */
  {
    id: 'all-employer-portal',
    title: 'Employer Portal',
    description: 'Post jobs, filter LBI-matched candidates and manage campus recruitment.',
    keywords: ['employer', 'portal', 'recruit', 'hiring', 'campus', 'placement', 'candidates', 'jobs', 'talent'],
    icon: Building2, iconColor: '#344E86', roles: ['hr', 'institute'], category: 'navigation',
    action: { type: 'navigate', screen: 'employer-portal' },
  },

  /* ─── Career Portals ───────────────────────────────────── */
  {
    id: 'all-student-career',
    title: 'Student Career Portal',
    description: 'Explore internships, fresher jobs and career paths aligned to your LBI profile.',
    keywords: ['student career', 'internship', 'fresher', 'job', 'career portal', 'placement', 'campus'],
    icon: Rocket, iconColor: '#4ECDC4', roles: ['student'], category: 'navigation',
    action: { type: 'navigate', screen: 'student-career-portal' },
  },
  {
    id: 'all-mentor-career',
    title: 'Mentor Career Portal',
    description: 'Apply as a mentor, manage your profile and track earnings.',
    keywords: ['mentor career', 'become mentor', 'mentor profile', 'earnings', 'apply', 'mentor dashboard'],
    icon: Handshake, iconColor: '#344E86', roles: ['hr', 'institute'], category: 'navigation',
    action: { type: 'navigate', screen: 'mentor-career-portal' },
  },

  /* ─── Competency Intelligence ──────────────────────────── */
  {
    id: 'all-competency',
    title: 'Competency Intelligence',
    description: '50-competency profile — benchmark against live industry cohorts and map career transitions.',
    keywords: ['competency', 'intelligence', 'cip', 'benchmark', 'industry', 'cohort', 'gap', 'career stage', 'skills'],
    icon: Layers, iconColor: '#4ECDC4', roles: ['hr', 'institute'], category: 'navigation',
    action: { type: 'navigate', screen: 'competency-dashboard' },
  },
  {
    id: 'all-competency-gap',
    title: 'Competency Gap Analysis',
    description: 'Identify skill gaps vs industry benchmarks and get priority learning actions.',
    keywords: ['competency gap', 'skill gap', 'analysis', 'industry', 'benchmark', 'improvement', 'learning priority'],
    icon: BarChart3, iconColor: '#0B3C5D', roles: ['hr', 'institute'], category: 'feature',
    action: { type: 'navigate', screen: 'competency-gap-analysis' },
  },

  /* ─── NGO Dashboard ────────────────────────────────────── */
  {
    id: 'all-ngo',
    title: 'NGO Dashboard',
    description: 'Program metrics, beneficiary tracking and impact reporting for NGOs.',
    keywords: ['ngo', 'nonprofit', 'program', 'beneficiary', 'impact', 'social', 'welfare', 'reporting'],
    icon: Globe, iconColor: '#4ECDC4', roles: ['institute'], category: 'navigation',
    action: { type: 'navigate', screen: 'ngo-dashboard' },
  },

  /* ─── Support & Help ───────────────────────────────────── */
  {
    id: 'all-support',
    title: 'Support / Help Centre',
    description: 'Get help, submit a ticket or read the FAQ.',
    keywords: ['support', 'help', 'faq', 'ticket', 'issue', 'contact', 'problem', 'report bug'],
    icon: HelpCircle, iconColor: '#0B3C5D', roles: ['student', 'parent', 'institute', 'hr'], category: 'help',
    action: { type: 'navigate', screen: 'support' },
  },
  {
    id: 'all-pricing',
    title: 'Pricing & Plans',
    description: 'Compare MetryxOne pricing tiers and upgrade your plan.',
    keywords: ['pricing', 'plan', 'upgrade', 'subscription', 'cost', 'tier', 'pro', 'enterprise'],
    icon: Package, iconColor: '#344E86', roles: ['student', 'parent', 'institute', 'hr'], category: 'navigation',
    action: { type: 'navigate', screen: 'pricing' },
  },

];

// ── Scoring ───────────────────────────────────────────────────────────────────

export function scoreItem(item: SearchItem, query: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 0;

  let s = 0;
  const title = item.title.toLowerCase();
  const desc  = item.description.toLowerCase();

  if (title === q)             s += 120;
  else if (title.startsWith(q)) s += 90;
  else if (title.includes(q))   s += 65;

  if (desc.includes(q)) s += 20;

  for (const kw of item.keywords) {
    const k = kw.toLowerCase();
    if (k === q)           s += 55;
    else if (k.startsWith(q)) s += 35;
    else if (k.includes(q))   s += 20;
  }

  return s;
}

export function filterAndScore(
  role: SearchRole,
  query: string,
  limit = 12,
): SearchItem[] {
  const q = query.trim();

  const items = SEARCH_INDEX.filter(
    (item) =>
      item.roles.includes(role) || item.roles.includes('all'),
  );

  if (!q) {
    return items
      .filter((i) => i.category === 'navigation')
      .slice(0, limit);
  }

  return items
    .map((item) => ({ item, score: scoreItem(item, q) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => item);
}
