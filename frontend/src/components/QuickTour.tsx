import { useState, useEffect } from 'react';
import {
  X, ChevronRight, ChevronLeft, Home, GraduationCap, FileText,
  PieChart, Brain, Heart, Award, Video, Target, Users, Sparkles,
  BookOpen, Check, BarChart3, Activity, UserPlus, Layers,
  MessageCircle, ClipboardList, Briefcase, Shield, UserCheck,
  Map
} from 'lucide-react';
import { type DashboardType, TOUR_KEYS } from '@/lib/tourUtils';

export type { DashboardType };

const BRAND = { primary: '#0B3C5D', teal: '#4ECDC4' };

interface TourStep {
  section?: string;
  icon: React.ReactNode;
  color: string;
  badge?: string;
  title: string;
  subtitle: string;
  description: string;
  tips: string[];
}

/* ─── PARENT DASHBOARD STEPS ─────────────────────────────────────── */
const PARENT_STEPS: TourStep[] = [
  {
    icon: <Sparkles size={22} />, color: BRAND.primary, badge: 'Welcome',
    title: 'Welcome to your Parent Portal',
    subtitle: 'Your child\'s intelligence command centre',
    description: 'MetryxOne gives you a full view of your child\'s academic performance, behavioural patterns, and growth — all in one place. Watch how each section works as we walk through it together.',
    tips: ['Switch between children using the child cards at the top', 'Every tab reveals a different layer of insight', 'All data is private — only you can see it'],
  },
  {
    section: 'overview', icon: <Home size={22} />, color: BRAND.primary, badge: 'Home',
    title: 'Home — Daily Overview',
    subtitle: 'Alerts, digest & quick actions',
    description: 'Your morning briefing. See important alerts, a weekly insight digest, and a side-by-side sibling comparison when you have 2+ children. Tap any alert to jump directly to the relevant section.',
    tips: ['Red alerts need action — tap them to navigate directly', 'The Weekly Digest can be exported as a PDF', 'Sibling comparison activates when 2+ children are linked'],
  },
  {
    section: 'education', icon: <GraduationCap size={22} />, color: BRAND.primary, badge: 'Academics',
    title: 'Academics — Education Foundation',
    subtitle: 'Board, grade, subjects & curriculum',
    description: 'Set your child\'s education board (CBSE, ICSE, IB, State Board) and grade. This unlocks board-specific content, curriculum-aligned study plans, and exam scheduling.',
    tips: ['Set the board first — it activates the most relevant content', 'Favourite subjects helps the AI prioritise recommendations', 'Linked to Tests & Planner for seamless exam scheduling'],
  },
  {
    section: 'tests-planner', icon: <FileText size={22} />, color: BRAND.primary, badge: 'Tests',
    title: 'Tests & Planner — Exam Management',
    subtitle: 'Schedule, supervise & track assessments',
    description: 'Schedule upcoming exams, run supervised tests right in the portal, and track scores over time. The study planner breaks revision into daily tasks tied to specific exam dates.',
    tips: ['Add school exams to get automatic countdown alerts', 'Supervised tests run directly through this portal', 'Study tasks link automatically to exam deadlines'],
  },
  {
    section: 'exam-trends', icon: <PieChart size={22} />, color: BRAND.primary, badge: 'Analytics',
    title: 'Analytics — Score Trends & Benchmarks',
    subtitle: 'Performance charts & peer comparison',
    description: 'Visual charts track progression across subjects. The Peer Cohort Benchmark compares your child against anonymised classmates at the same grade and board — so you know where they truly stand.',
    tips: ['The trend line shows improvement velocity, not just latest scores', 'Peer benchmarks are fully anonymised — no individual is identified', 'Subject breakdown reveals which topics need most attention'],
  },
  {
    section: 'lbi', icon: <Brain size={22} />, color: BRAND.teal, badge: 'Behaviour',
    title: 'Behaviour — Learning Behaviour Insights',
    subtitle: '19-domain behavioural intelligence report',
    description: 'The LBI maps your child\'s cognitive and emotional patterns across 19 domains. The Subject-Linked LBI shows exactly which behavioural traits affect which school subjects.',
    tips: ['Grant LBI consent first (required for minors)', 'Assessment takes ~30 mins and is done once per term', 'Share the report with your child\'s teacher via the Share button'],
  },
  {
    section: 'enterprise-hub', icon: <Heart size={22} />, color: BRAND.teal, badge: 'Wellness',
    title: 'Wellness Hub — Holistic Wellbeing',
    subtitle: 'Mood tracking, burnout risk & career compass',
    description: 'Daily check-ins track mood and energy over time. The burnout risk indicator alerts you before stress becomes serious. Career Compass™ matches your child\'s LBI profile to careers they are naturally wired for.',
    tips: ['Daily check-ins take under 30 seconds', 'Burnout risk signals appear on the Home tab automatically', 'Career suggestions improve as more assessment data is collected'],
  },
  {
    section: 'mentor-services', icon: <Video size={22} />, color: BRAND.primary, badge: 'Mentors',
    title: 'Mentor Services — Sessions & Progress',
    subtitle: 'AI-matched mentors with live video & reports',
    description: 'Book video sessions with AI-recommended mentors matched to your child\'s subject gaps and learning style. Choose individual or group study. Session quality scores and progress reports are generated automatically.',
    tips: ['AI recommends mentors based on current academic stage', 'Group Study costs 30% less and adds peer motivation', 'Progress reports generate automatically after every 4 sessions'],
  },
  {
    section: 'goals', icon: <Target size={22} />, color: BRAND.teal, badge: 'Goals',
    title: 'Goals — Parent-Child Contracts',
    subtitle: 'Shared commitments with milestone tracking',
    description: 'Create goal contracts that both you and your child commit to — academic targets, behaviour improvements, wellness habits, or career exploration. Break goals into milestones and track progress together.',
    tips: ['Goal types: Academic, Behaviour, Wellness, Career', 'Add milestones to make big goals feel achievable', 'Progress is visible to both parent and child'],
  },
  {
    section: 'my-packages', icon: <Award size={22} />, color: BRAND.primary, badge: 'Packages',
    title: 'Packages — LBI Assessment Bundles',
    subtitle: 'Assign and manage assessment packages',
    description: 'Purchase and assign LBI assessment packages. Each package includes the full 19-domain assessment, an AI written report, and optional mentor follow-up. Multi-child families are managed from one place.',
    tips: ['Results are instant — no waiting for manual scoring', 'One package covers the full assessment + AI report', 'Packages can also be gifted to friends or family'],
  },
  {
    icon: <Check size={22} />, color: BRAND.teal, badge: 'Done!',
    title: 'You\'re all set!',
    subtitle: 'Start by setting up your child\'s profile',
    description: 'Tour complete. Re-open this guide any time from the "Quick Tour" button in the sidebar. Start by selecting your child and setting their education board in the Academics tab.',
    tips: ['Milestone celebrations appear automatically on new score records', 'The AI assistant (bottom-right) can answer questions about your child\'s data', 'Tap "Quick Tour" in the sidebar to revisit this walkthrough'],
  },
];

/* ─── INSTITUTE DASHBOARD STEPS ──────────────────────────────────── */
const INSTITUTE_STEPS: TourStep[] = [
  {
    icon: <Sparkles size={22} />, color: BRAND.primary, badge: 'Welcome',
    title: 'Welcome to the Institute Portal',
    subtitle: 'Your school\'s intelligence command centre',
    description: 'Manage students, exams, batches, and get real-time behavioural intelligence for your entire cohort. Watch each section come alive as we walk through it.',
    tips: ['Use the sidebar to navigate between sections', 'Live Analytics update in real time as students complete assessments', 'All data is anonymised when viewed at cohort level'],
  },
  {
    section: 'overview', icon: <BarChart3 size={22} />, color: BRAND.primary, badge: 'Overview',
    title: 'Overview — School at a Glance',
    subtitle: 'Key stats, quick actions & feature map',
    description: 'See total students, active exams, pending enrollments, and batch counts at a glance. Use the feature cards to jump directly into any section of the dashboard.',
    tips: ['Pending enrollments shown in the top notification badge', 'Quick-access cards navigate to Students, Exams, Batches and Analytics', 'Stats refresh automatically every few minutes'],
  },
  {
    section: 'students', icon: <Users size={22} />, color: BRAND.primary, badge: 'Students',
    title: 'Students — Profile Management',
    subtitle: 'Add, import & manage student records',
    description: 'Add students manually or import them in bulk. Each profile stores academic history, batch assignment, and consent status. Full DPDP & FERPA compliance built in.',
    tips: ['Bulk import via CSV for onboarding entire classes at once', 'Consent status is tracked per student for LBI assessments', 'Search and filter by grade, batch, or enrollment status'],
  },
  {
    section: 'exams', icon: <FileText size={22} />, color: BRAND.primary, badge: 'Exams',
    title: 'Exams — Assessment Builder',
    subtitle: 'Create MCQ exams with auto-grading',
    description: 'Build exams from scratch or from a question bank. Auto-grading generates instant score reports. Assign exams to specific batches with custom time windows.',
    tips: ['Question bank lets you reuse questions across multiple exams', 'Auto-grading scores are available the moment a student submits', 'Set per-batch time windows so different classes sit the same exam'],
  },
  {
    section: 'batches', icon: <Layers size={22} />, color: BRAND.primary, badge: 'Batches',
    title: 'Batches — Class Organisation',
    subtitle: 'Group students into classes and sections',
    description: 'Create and manage batches (classes or sections). Assign students to batches, then link batches to exams and study plans for targeted delivery.',
    tips: ['One student can belong to multiple batches', 'Batch analytics show class-level performance trends', 'Rename or archive batches at the end of each academic year'],
  },
  {
    section: 'enrollments', icon: <UserPlus size={22} />, color: BRAND.primary, badge: 'Enrollments',
    title: 'Enrollments — Admission Pipeline',
    subtitle: 'Manage pending and approved enrollments',
    description: 'Review new enrollment requests, approve or reject, and automatically assign approved students to the right batch. Keep a clean admission pipeline without manual spreadsheets.',
    tips: ['Approve or reject with one click from this section', 'Approved students are automatically added to the assigned batch', 'Enrollment history is kept for audit purposes'],
  },
  {
    section: 'analytics', icon: <PieChart size={22} />, color: BRAND.primary, badge: 'Analytics',
    title: 'Live Analytics — Performance Intelligence',
    subtitle: 'Real-time scores, trends & at-risk signals',
    description: 'Track class-level performance across subjects. Identify at-risk students before exams using score trends and engagement signals. All charts update live as assessments are submitted.',
    tips: ['The at-risk filter highlights students who need immediate support', 'Subject heatmaps show class-wide weak areas', 'Export reports to PDF or CSV for parent communications'],
  },
  {
    section: 'reports', icon: <ClipboardList size={22} />, color: BRAND.primary, badge: 'Reports',
    title: 'Reports — Downloadable Summaries',
    subtitle: 'Auto-generated PDF and CSV reports',
    description: 'Generate class-level, batch-level, or school-wide reports on demand. Reports include score distributions, LBI cohort profiles, and attendance summaries.',
    tips: ['Schedule automatic monthly reports to be emailed to principals', 'Reports are branded with your institution\'s logo', 'Share individual student reports with parents via the portal'],
  },
  {
    section: 'lbi-product', icon: <Brain size={22} />, color: BRAND.teal, badge: 'Behaviour',
    title: 'Behaviour Assessment — Class LBI',
    subtitle: 'Cohort-level learning behaviour profiles',
    description: 'See the distribution of LBI domain scores across your entire cohort. Identify class-wide patterns — like low emotional regulation or high analytical strength — and inform teaching strategies accordingly.',
    tips: ['Assign LBI assessments to entire batches at once', 'Cohort data is always anonymised at class level', 'Correlate LBI domains with exam performance in the Analytics section'],
  },
  {
    section: 'school-health', icon: <Activity size={22} />, color: BRAND.teal, badge: 'School Health',
    title: 'School Health — Cohort Wellbeing',
    subtitle: 'Class-wide mood, burnout risk & wellness trends',
    description: 'The School Health Dashboard aggregates anonymised wellness signals from daily check-ins across your cohort. Spot burnout risk spikes before they affect exam performance.',
    tips: ['Burnout risk is shown as a cohort percentage, never individually', 'Filter by grade or batch to see wellness patterns per class', 'Use these insights to plan intervention sessions or counselling'],
  },
  {
    section: 'exam-ready', icon: <Target size={22} />, color: BRAND.primary, badge: 'Exam Ready',
    title: 'Exam Readiness — Predictive Index',
    subtitle: 'AI-scored readiness for each upcoming exam',
    description: 'The ExamReadiness Index™ scores each student\'s predicted readiness for an upcoming exam, based on past scores, LBI profiles, and study plan engagement. Act before the exam, not after.',
    tips: ['Readiness scores update daily as students complete revision tasks', 'Export readiness reports to share with class teachers', 'Low-readiness students are flagged for parent notification'],
  },
  {
    icon: <Check size={22} />, color: BRAND.teal, badge: 'Done!',
    title: 'Tour complete — explore your institute!',
    subtitle: 'Navigate using the sidebar any time',
    description: 'You\'ve seen all the key sections. Re-open this guide from the "Quick Tour" button near Help in the sidebar. Start by adding your students and creating your first batch.',
    tips: ['Add students first, then create batches and assign them', 'Set up an exam, then use Analytics to track results', 'Use School Health to monitor cohort wellbeing throughout the term'],
  },
];

/* ─── HR DASHBOARD STEPS ─────────────────────────────────────────── */
const HR_STEPS: TourStep[] = [
  {
    icon: <Sparkles size={22} />, color: BRAND.primary, badge: 'Welcome',
    title: 'Welcome to the HR Dashboard',
    subtitle: 'Behavioural intelligence for hiring & mentoring',
    description: 'Manage job postings, mentor approvals, compliance, and a new AI-powered behavioral hiring module — all from one unified HR command centre.',
    tips: ['Use the tabs to navigate between sections', 'Approval workflows keep every hiring decision audited', 'Behavioral Hiring is powered by the same LBI science as the student platform'],
  },
  {
    section: 'overview', icon: <BarChart3 size={22} />, color: BRAND.primary, badge: 'Overview',
    title: 'Overview — HR Metrics at a Glance',
    subtitle: 'Jobs, applications, mentors & compliance stats',
    description: 'Your HR command centre. See total job postings, pending approvals, application volumes, active mentors, and open compliance violations — all in a single view.',
    tips: ['Pending approvals are the primary action item when you log in', 'At-risk mentors are flagged when their performance dips below threshold', 'All stats refresh automatically'],
  },
  {
    section: 'jobs', icon: <Briefcase size={22} />, color: BRAND.primary, badge: 'Jobs',
    title: 'Job Postings — Role Management',
    subtitle: 'Create, review & publish open positions',
    description: 'Draft new job postings for mentor, counselor, trainer, or admin roles. Each posting goes through a multi-step approval workflow before going live. Track status from draft all the way to published.',
    tips: ['Use role categories to activate the right LBI competency profile', 'Status moves: Draft → HR Review → Legal → Leadership → Published', 'Closed postings are archived for reporting purposes'],
  },
  {
    section: 'approvals', icon: <UserCheck size={22} />, color: BRAND.primary, badge: 'Approvals',
    title: 'Approvals — Multi-Step Workflow',
    subtitle: 'HR review, legal sign-off & leadership approval',
    description: 'Every job posting and mentor application flows through configurable approval stages. Each stage is timestamped and the approver is recorded for a full audit trail.',
    tips: ['Approve or reject with comments directly from this view', 'All decisions are logged with timestamp and approver name', 'Leadership approvals are the final gate before publishing'],
  },
  {
    section: 'mentors', icon: <Users size={22} />, color: BRAND.primary, badge: 'Mentors',
    title: 'Mentors — Active Roster Management',
    subtitle: 'Onboarding, performance & at-risk monitoring',
    description: 'View and manage all active mentors. Track session completion rates, student satisfaction scores, and flag mentors who are at risk of underperformance before it becomes a problem.',
    tips: ['At-risk mentors are automatically flagged based on quality scores', 'Each mentor profile links to their full session history', 'Use the filter to sort by subject area or risk status'],
  },
  {
    section: 'compliance', icon: <Shield size={22} />, color: BRAND.primary, badge: 'Compliance',
    title: 'Compliance — Violations & Audits',
    subtitle: 'Policy enforcement and payout management',
    description: 'Track pending compliance violations, manage payout approvals, and run audit reports. All mentor contracts and violation records are stored here with full documentation.',
    tips: ['Pending violations need resolution before payout is released', 'Audit reports can be exported for external review', 'All records are DPDP & FERPA compliant'],
  },
  {
    section: 'behavioral-hiring', icon: <Brain size={22} />, color: BRAND.teal, badge: 'Behavioral Hiring',
    title: 'Behavioral Hiring — LBI-Matched Candidates',
    subtitle: 'Score candidates against role competency profiles',
    description: 'The AI matches candidates\' LBI behavioral profiles against the competency requirements of each open role. Get a behavioral fit score before the first interview — hire for how candidates think, not just what they know.',
    tips: ['Each role has a pre-built competency profile from MetryxOne\'s 50+ domain library', 'Behavioral fit scores complement — not replace — traditional screening', 'Scores are explainable: see which LBI domains drove the match'],
  },
  {
    icon: <Check size={22} />, color: BRAND.teal, badge: 'Done!',
    title: 'HR tour complete!',
    subtitle: 'Start by reviewing pending approvals',
    description: 'You\'ve seen the full HR dashboard. Re-open this guide from the Help area any time. The fastest first step is usually to clear pending approvals and check the Behavioral Hiring tab for open roles.',
    tips: ['Start with Approvals — clear the queue before opening new postings', 'Set up a job posting and link it to a behavioral profile for best results', 'Monitor mentor health weekly from the Mentors tab'],
  },
];

/* ─── STUDENT DASHBOARD STEPS ────────────────────────────────────── */
const STUDENT_STEPS: TourStep[] = [
  {
    icon: <Sparkles size={22} />, color: BRAND.primary, badge: 'Welcome',
    title: 'Welcome to Your Student Dashboard',
    subtitle: 'Your personal learning command centre',
    description: 'MetryxOne tracks your academic progress, behavioural intelligence, and daily growth — all in one place. This 2-minute tour shows you what every section does.',
    tips: ['Complete daily missions to earn XP and level up', 'Your streak grows every day you log in', 'All data is private — only you and your parent can see it'],
  },
  {
    section: 'dashboard', icon: <Home size={22} />, color: BRAND.primary, badge: 'Dashboard',
    title: 'Your Live Profile Banner',
    subtitle: 'Avatar, level badge & XP progress',
    description: 'Your banner shows your name, earned title, and current level badge. The XP progress bar fills as you complete missions and assessments, showing exactly how far you are from your next level.',
    tips: ['Levels go: Explorer → Learner → Achiever → Leader → Master', 'The bar fills fastest through daily missions + LBI assessment', 'Your streak, completed exams, and avg score update in real time'],
  },
  {
    section: 'kpi', icon: <BarChart3 size={22} />, color: BRAND.primary, badge: 'Stats',
    title: 'Performance KPIs',
    subtitle: 'Total exams, completed, avg score & XP',
    description: 'Four tiles give you a bird\'s eye view of your academic journey. Total Exams shows all available tests, Completed tracks your progress, Avg Score reflects your performance, and XP shows gamification points earned.',
    tips: ['Avg Score updates automatically after every completed exam', 'XP grows fastest through daily missions and assessments', 'Scores feed into your AI Exam Readiness prediction'],
  },
  {
    section: 'quick-access', icon: <Layers size={22} />, color: BRAND.primary, badge: 'Quick Access',
    title: 'Quick Access Grid',
    subtitle: 'Jump into any feature with one tap',
    description: 'These cards navigate to your most-used features: My Exams, LBI Assessment, Exam Readiness, Daily Missions, Learning Forum, XP & Rewards, Collab Hub, Study Planner, and Assignments.',
    tips: ['LBI Assessment becomes active after parental consent', 'Exam Readiness gives a predicted score before every upcoming test', 'Collab Hub lets you study with peers and share notes'],
  },
  {
    section: 'gamification', icon: <Award size={22} />, color: BRAND.teal, badge: 'Level Up',
    title: 'Gamification Panel',
    subtitle: 'XP, coins, streak & missions progress',
    description: 'Your XP, coins, streak days, and missions completed today are tracked here. Level up from Explorer to Master by earning XP consistently through assessments and daily tasks.',
    tips: ['Coins are redeemable for gift cards, course passes, and mentorship', 'Your streak resets if you skip a day — log in daily!', 'Missions are the fastest way to earn XP each day'],
  },
  {
    section: 'missions', icon: <Target size={22} />, color: '#D97706', badge: 'Missions',
    title: "Today's Daily Missions",
    subtitle: '3 tasks · Reset every midnight',
    description: 'Each day brings 3 fresh missions — Study, Skill, and Behaviour types. Complete all 3 to maximise your XP and coins. Missions reset at midnight so consistency is key.',
    tips: ['Study missions link directly to your exam list', 'Skill missions test you with quick knowledge challenges', 'Behaviour missions include your daily wellness check-in'],
  },
  {
    section: 'study-planner', icon: <BookOpen size={22} />, color: '#0B3C5D', badge: 'Study Planner',
    title: 'Study Planner',
    subtitle: 'Plan, schedule & track study sessions',
    description: 'Create structured study plans tied to specific subjects and exam dates. Break revision into daily tasks so nothing is left to the last minute before a big exam.',
    tips: ['Add tasks by subject and assign a date and duration', 'Completed tasks contribute to your daily mission XP', 'Study streaks are tracked per subject for extra motivation'],
  },
  {
    section: 'assignments', icon: <ClipboardList size={22} />, color: '#D97706', badge: 'Assignments',
    title: 'Assignments',
    subtitle: 'School tasks, practice papers & sessions',
    description: 'Track assignments given by your school or institute. View deadlines, mark tasks done, and log session attendance — all from one place.',
    tips: ['Filter by subject or due date to stay organised', 'Completed assignments add to your overall progress score', 'Late assignments are flagged automatically in red'],
  },
  {
    section: 'wellness', icon: <Heart size={22} />, color: '#4ECDC4', badge: 'Wellness',
    title: 'Wellness Hub',
    subtitle: 'Mood, energy & burnout tracking',
    description: 'Log your mood and energy level every day. The Wellness Hub tracks patterns over time and flags early signs of burnout before they affect your study performance.',
    tips: ['Check-ins take under 30 seconds — do them daily', 'Your wellness data is private unless burnout risk is high', 'Weekly summaries help you spot emotional patterns over time'],
  },
  {
    section: 'lbi', icon: <Brain size={22} />, color: BRAND.teal, badge: 'LBI',
    title: 'LBI Assessment',
    subtitle: 'Behavioural intelligence across 7 domains',
    description: 'The Learning Behaviour Insights (LBI) assessment maps your cognitive strengths across 7 domains. It takes about 30 minutes and reveals how you naturally think, focus, and learn best.',
    tips: ['Requires parental consent before starting', 'Complete all 7 domains to unlock your full AI behavioural report', 'Your LBI profile personalises every AI study recommendation you receive'],
  },
  {
    section: 'career', icon: <Briefcase size={22} />, color: BRAND.primary, badge: 'Career Intel',
    title: 'Career Intelligence',
    subtitle: 'AI-matched career paths from your LBI',
    description: 'Once your LBI assessment is complete, Career Intelligence matches your behavioural profile against 160+ careers. Discover which professions you are naturally wired to excel in.',
    tips: ['Career suggestions improve as more LBI data is collected', 'Each career shows a fit score and the matching LBI domains', 'Book a mentor session for career deep-dives directly from this page'],
  },
  {
    icon: <Check size={22} />, color: BRAND.teal, badge: "You're Set!",
    title: "Ready to start learning!",
    subtitle: 'Start with a mission or browse your exams',
    description: "Tour complete! Re-open this guide any time using the 'Quick Tour' button at the top of your dashboard. Best first step: complete today's 3 missions and check your upcoming exams.",
    tips: ["Tap 'Quick Tour' in the header any time to replay this walkthrough", 'Daily login keeps your streak alive — even 5 minutes counts', 'Reach Level 2 by earning your first 200 XP'],
  },
];

const STEPS_MAP: Record<DashboardType, TourStep[]> = {
  parent: PARENT_STEPS,
  institute: INSTITUTE_STEPS,
  hr: HR_STEPS,
  student: STUDENT_STEPS,
};

/* ─── POSITIONING ─────────────────────────────────────────────────── */
const TEAL = '#4ECDC4';
const TW   = 288; // tooltip width px
const GAP  = 10;  // gap between element and tooltip

type Arrow = 'up' | 'down' | 'left' | 'none';
interface Pos { top: number; left: number; arrow: Arrow; arrowX: number; arrowY: number; }

function measurePos(section: string): Pos | null {
  const selectors = [
    `[data-testid="tab-${section}"]`,
    `[data-testid="nav-${section}"]`,
    `[data-testid="menu-${section}"]`,
  ];
  let el: Element | null = null;
  for (const s of selectors) { el = document.querySelector(s); if (el) break; }
  if (!el) return null;

  const r   = el.getBoundingClientRect();
  const mid = r.left + r.width / 2;
  const vw  = window.innerWidth;
  const vh  = window.innerHeight;

  // Sidebar item (left edge < 220px) → tooltip to the right
  if (r.right < 220) {
    const top = Math.min(r.top + r.height / 2 - 60, vh - 320);
    return { top: Math.max(8, top), left: r.right + GAP, arrow: 'left', arrowX: 0, arrowY: 60 };
  }

  // Tab at top — place below if room, else above
  const spaceBelow = vh - r.bottom;
  if (spaceBelow > 260 || spaceBelow >= vh - r.top) {
    let left = Math.round(mid - TW / 2);
    left = Math.max(8, Math.min(vw - TW - 8, left));
    return { top: r.bottom + GAP, left, arrow: 'up', arrowX: Math.round(mid - left), arrowY: 0 };
  }

  // Place above
  let left = Math.round(mid - TW / 2);
  left = Math.max(8, Math.min(vw - TW - 8, left));
  return { top: r.top - GAP - 10, left, arrow: 'down', arrowX: Math.round(mid - left), arrowY: 0 };
}

/* ─── COMPONENT ───────────────────────────────────────────────────── */
interface Props {
  type?: DashboardType;
  onClose: () => void;
  onNavigate?: (section: string) => void;
}

export function QuickTour({ type = 'parent', onClose, onNavigate }: Props) {
  const steps   = STEPS_MAP[type];
  const [step, setStep]           = useState(0);
  const [dir,  setDir]            = useState<'fwd' | 'bwd'>('fwd');
  const [animKey, setAnimKey]     = useState(0);
  const [visible, setVisible]     = useState(false);
  const [pos, setPos]             = useState<Pos | null>(null);
  const [minimised, setMinimised] = useState(false);

  // Measure target element position after step/render
  const measureStep = (s: number) => {
    const section = STEPS_MAP[type][s]?.section;
    if (!section) { setPos(null); return; }
    // wait for tab to actually switch before measuring
    requestAnimationFrame(() => {
      setTimeout(() => setPos(measurePos(section)), 80);
    });
  };

  useEffect(() => {
    setTimeout(() => { setVisible(true); measureStep(0); }, 80);
    const onResize = () => measureStep(step);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const goTo = (next: number) => {
    if (next < 0 || next >= steps.length) return;
    setDir(next > step ? 'fwd' : 'bwd');
    setStep(next);
    setAnimKey(k => k + 1);
    const s = steps[next];
    if (s.section && onNavigate) onNavigate(s.section);
    measureStep(next);
  };

  const handleClose = () => {
    try { localStorage.setItem(TOUR_KEYS[type], '1'); } catch {}
    setVisible(false);
    setTimeout(onClose, 200);
  };

  const current = steps[step];
  const isLast  = step === steps.length - 1;

  // Compute final CSS position
  let style: React.CSSProperties;
  if (pos) {
    style = { top: pos.top, left: pos.left };
  } else {
    // fallback: centered just below header
    style = { top: 80, left: '50%', transform: 'translateX(-50%)' };
  }

  // Arrow element
  const arrow = pos?.arrow ?? 'none';
  const arrowX = pos?.arrowX ?? TW / 2;
  const arrowY = pos?.arrowY ?? 0;

  return (
    <>
      <style>{`
        @keyframes tg-pop {
          from { opacity:0; transform:scale(0.93) translateY(6px); }
          to   { opacity:1; transform:scale(1)    translateY(0); }
        }
        @keyframes tg-fwd { from { opacity:0; transform:translateX(12px); } to { opacity:1; transform:translateX(0); } }
        @keyframes tg-bwd { from { opacity:0; transform:translateX(-12px);} to { opacity:1; transform:translateX(0); } }
        .tg-pop { animation: tg-pop 0.2s cubic-bezier(0.23,1,0.32,1) both; }
        .tg-fwd { animation: tg-fwd 0.15s cubic-bezier(0.23,1,0.32,1) both; }
        .tg-bwd { animation: tg-bwd 0.15s cubic-bezier(0.23,1,0.32,1) both; }
        .tg-highlight {
          outline: 2.5px solid ${TEAL} !important;
          outline-offset: 2px;
          border-radius: 6px;
          transition: outline 0.2s;
        }
      `}</style>

      {/* Tooltip card */}
      <div
        className="tg-pop fixed z-[300]"
        style={{
          ...style,
          width: TW,
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.18s ease, top 0.25s cubic-bezier(0.23,1,0.32,1), left 0.25s cubic-bezier(0.23,1,0.32,1)',
          background: '#fff',
          borderRadius: 10,
          border: `1.5px solid ${TEAL}35`,
          boxShadow: `0 6px 28px rgba(0,0,0,0.11), 0 0 0 1px ${TEAL}20`,
        }}
      >
        {/* Arrow — up */}
        {arrow === 'up' && (
          <div style={{
            position: 'absolute', top: -8, left: arrowX - 8, width: 16, height: 8, overflow: 'hidden',
          }}>
            <div style={{
              width: 14, height: 14, background: '#fff', border: `1.5px solid ${TEAL}35`,
              transform: 'rotate(45deg)', transformOrigin: 'center', margin: '4px auto 0',
              boxShadow: `-1px -1px 3px rgba(0,0,0,0.06)`,
            }} />
          </div>
        )}

        {/* Arrow — down */}
        {arrow === 'down' && (
          <div style={{
            position: 'absolute', bottom: -8, left: arrowX - 8, width: 16, height: 8, overflow: 'hidden',
          }}>
            <div style={{
              width: 14, height: 14, background: '#fff', border: `1.5px solid ${TEAL}35`,
              transform: 'rotate(45deg)', transformOrigin: 'center', margin: '-6px auto 0',
              boxShadow: `1px 1px 3px rgba(0,0,0,0.06)`,
            }} />
          </div>
        )}

        {/* Arrow — left (sidebar) */}
        {arrow === 'left' && (
          <div style={{
            position: 'absolute', left: -8, top: arrowY - 8, width: 8, height: 16, overflow: 'hidden',
          }}>
            <div style={{
              width: 14, height: 14, background: '#fff', border: `1.5px solid ${TEAL}35`,
              transform: 'rotate(45deg)', transformOrigin: 'center', margin: '1px 4px 0 0',
              boxShadow: `-1px 1px 3px rgba(0,0,0,0.06)`,
            }} />
          </div>
        )}

        {/* Teal top accent */}
        <div style={{ height: 3, background: TEAL, borderRadius: '8px 8px 0 0' }} />

        {/* Header */}
        <div className="flex items-center gap-1.5 px-3 py-2" style={{ borderBottom: `1px solid ${TEAL}18` }}>
          <div className="w-5 h-5 rounded flex items-center justify-center text-white shrink-0" style={{ background: TEAL }}>
            <Map size={10} />
          </div>
          <span className="text-[9px] font-bold tracking-widest flex-1 select-none" style={{ color: TEAL }}>TOUR GUIDE</span>
          <span className="text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded-full" style={{ background: `${TEAL}15`, color: TEAL }}>
            {step + 1} / {steps.length}
          </span>
          <button onClick={() => setMinimised(m => !m)} className="w-5 h-5 rounded hover:bg-gray-100 flex items-center justify-center" title="Minimise">
            <ChevronLeft size={11} className={`text-gray-400 transition-transform ${minimised ? '-rotate-90' : 'rotate-90'}`} />
          </button>
          <button onClick={handleClose} className="w-5 h-5 rounded hover:bg-gray-100 flex items-center justify-center" title="Close">
            <X size={11} className="text-gray-400" />
          </button>
        </div>

        {/* Body */}
        {!minimised && (
          <div key={animKey} className={dir === 'fwd' ? 'tg-fwd' : 'tg-bwd'}>
            {/* Section info */}
            <div className="flex items-start gap-2.5 px-3 pt-2.5 pb-1.5">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: TEAL }}>
                {current.icon}
              </div>
              <div className="flex-1 min-w-0">
                {current.badge && (
                  <span className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-[1px] rounded inline-block mb-0.5"
                    style={{ background: `${TEAL}18`, color: TEAL }}>
                    {current.badge}
                  </span>
                )}
                <p className="text-[12px] font-bold text-gray-900 leading-snug">{current.title}</p>
                <p className="text-[10px] text-gray-400 leading-snug mt-0.5">{current.subtitle}</p>
              </div>
            </div>

            {/* Description */}
            <p className="text-[11px] text-gray-500 leading-relaxed px-3 pb-1.5">{current.description}</p>

            {/* Tips */}
            <div className="px-3 pb-2.5 space-y-1">
              {current.tips.map((tip, i) => (
                <p key={i} className="text-[10px] leading-relaxed" style={{ color: `${TEAL}bb` }}>{tip}</p>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-1.5 px-3 pb-2.5 pt-2" style={{ borderTop: `1px solid ${TEAL}15` }}>
              <div className="flex items-center gap-[3px] flex-1">
                {steps.map((_, i) => (
                  <button key={i} onClick={() => goTo(i)} className="rounded-full transition-all duration-300"
                    style={{ width: i === step ? 14 : 4, height: 4,
                      background: i === step ? TEAL : i < step ? `${TEAL}55` : '#e5e7eb' }} />
                ))}
              </div>
              {step > 0
                ? <button onClick={() => goTo(step - 1)} className="flex items-center gap-0.5 px-2 py-1 rounded-md border border-gray-200 text-[10px] text-gray-500 hover:bg-gray-50">
                    <ChevronLeft size={10} /> Back
                  </button>
                : <button onClick={handleClose} className="px-2 py-1 rounded-md border border-gray-200 text-[10px] text-gray-400 hover:bg-gray-50">
                    Skip
                  </button>
              }
              {isLast
                ? <button onClick={handleClose} className="flex items-center gap-0.5 px-3 py-1 rounded-md text-white text-[10px] font-semibold hover:opacity-90" style={{ background: TEAL }}>
                    <Check size={9}/> Done
                  </button>
                : <button onClick={() => goTo(step + 1)} className="flex items-center gap-0.5 px-3 py-1 rounded-md text-white text-[10px] font-semibold hover:opacity-90" style={{ background: TEAL }}>
                    Next <ChevronRight size={10}/>
                  </button>
              }
            </div>
          </div>
        )}

        {/* Minimised strip */}
        {minimised && (
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="flex-1 h-1 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.round((step / (steps.length - 1)) * 100)}%`, background: TEAL }} />
            </div>
            {step > 0 && <button onClick={() => goTo(step - 1)} className="flex items-center gap-0.5 px-2 py-0.5 rounded border border-gray-200 text-[9px] text-gray-400 hover:bg-gray-50"><ChevronLeft size={9}/>Back</button>}
            <button onClick={isLast ? handleClose : () => goTo(step + 1)} className="flex items-center gap-0.5 px-2 py-0.5 rounded text-white text-[9px] font-semibold" style={{ background: TEAL }}>
              {isLast ? <><Check size={8}/> Done</> : <>Next<ChevronRight size={9}/></>}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

