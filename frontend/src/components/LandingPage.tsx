import { BRAND_NAVY as BRAND } from '@/design-system/tokens';
import React, { useState, useEffect, useRef, memo } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useTheme } from "@/contexts/ThemeContext";
import avatarImg1 from "@/assets/images/avatar1.jpg";
import avatarImg2 from "@/assets/images/avatar2.jpg";
import avatarImg3 from "@/assets/images/avatar3.jpg";
import { LazySection } from "@/components/ui/LazySection";
import { FreeAssessmentModal } from "@/components/FreeAssessmentModal";
import { PragatiWorkspace } from "@/components/PragatiWorkspace";
// LiveStatsPulse removed from hero per user request
import { SectionBackground } from "@/components/ui/SectionBackground";
import { motion, AnimatePresence, useScroll } from "framer-motion";
import { Screen } from "../App";
import { 
  ShieldCheck, 
  Target, 
  Brain,
  Play,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  GraduationCap,
  Briefcase,
  Building2,
  Sparkles,
  CheckCircle,
  FileText,
  BarChart3,
  Users,
  Award,
  Lock,
  Quote,
  Zap,
  Heart,
  Star,
  Clock,
  Shield,
  BookOpen,
  Calendar,
  Globe2,
  ArrowRight,
  Video,
  Search,
  LayoutDashboard,
  UserCheck,
  Settings,
  Gauge,
  GitMerge,
  Lightbulb,
  Rocket,
  Layers,
  X
} from "lucide-react";

interface LandingPageProps {
  onNavigate: (screen: Screen) => void;
  deepLinkSessionId?: string | null;
  deepLinkModalOpen?: boolean;
  onReopenReport?: () => void;
  onClearDeepLink?: () => void;
}



const ROTATING_HEADLINES = [
  "Behavioral intelligence that turns potential into measurable performance.",
  "Decode how people think. Predict how they'll perform.",
  "The intelligence platform for schools, campuses, and enterprises.",
  "From classroom to boardroom — one intelligence layer for all decisions.",
  "19 behavioral domains. 97 subdomains. One unified intelligence platform.",
  "500+ organizations trust MetryxOne to power human potential.",
  "50 competencies. 7 industries. Know exactly where talent stands — and who's ready for what's next.",
];

const VIDEO_SLIDES = [
  {
    id: "schools",
    title: "Schools: Understand how students really learn",
    caption: "Cognitive readiness, exam patterns, and learning behaviour — decoded for teachers and parents.",
    theme: "student",
  },
  {
    id: "campus",
    title: "Campus Hiring: Smarter placement drives at scale",
    caption: "Screen candidates on cognitive ability, role-fit, and adaptability — not just marks.",
    theme: "parent",
  },
  {
    id: "employability",
    title: "Employability: Measure workforce readiness",
    caption: "Identify skill gaps, thinking quality, and career-readiness for job seekers and skilling platforms.",
    theme: "planning",
  },
  {
    id: "enterprise",
    title: "Enterprise: Competency benchmarks that drive smarter hiring & growth",
    caption: "Map 50 competencies against real industry cohorts. Identify gaps, predict role-fit, and simulate growth — for every role, stage, and industry.",
    theme: "institution",
  },
  {
    id: "competency",
    title: "Competency Intelligence: From gap to growth in one platform",
    caption: "Universal benchmarking, role transition scoring, hiring prediction, and personalised intervention paths — powered by 7-industry benchmark data.",
    theme: "planning",
  },
];

const TESTIMONIALS = [
  { 
    id: "priya",
    quote: "Finally, a platform that doesn't label my child but helps us understand how she thinks and learns. The insights were eye-opening.", 
    author: "Priya Sharma", 
    role: "Parent of Class 10 Student",
    avatar: "PS"
  },
  { 
    id: "rajesh",
    quote: "MetryxOne helped our school identify learning patterns across cohorts without individual ranking. Policy-aligned and privacy-first.", 
    author: "Dr. Rajesh Kumar", 
    role: "Principal, DPS Noida",
    avatar: "RK"
  },
  { 
    id: "arjun",
    quote: "The ExamReadiness Index assessment helped me understand why I freeze during exams. Now I have strategies that actually work.", 
    author: "Arjun Mehta", 
    role: "Class 12 Student, JEE Aspirant",
    avatar: "AM"
  },
  { 
    id: "anita",
    quote: "We've seen a 23% improvement in student wellbeing metrics after implementing MetryxOne across our institution.", 
    author: "Dr. Anita Desai", 
    role: "Director, Vidya Niketan Group",
    avatar: "AD"
  },
  { 
    id: "vikram",
    quote: "The cognitive pattern analysis helped us understand why our top performer was struggling with certain subjects. Game-changer.", 
    author: "Vikram Patel", 
    role: "Parent of Class 8 Student",
    avatar: "VP"
  },
];

function TestimonialsSection() {
  return (
    <section id="testimonials" className="py-16" style={{ backgroundColor: "#ffffff" }}>
      <div className="container mx-auto px-6 max-w-6xl">
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="inline-block px-4 py-1.5 rounded-full text-xs mb-4 font-semibold" style={{ backgroundColor: "rgba(11,60,93,0.08)", color: "#0B3C5D", border: "1px solid rgba(11,60,93,0.15)" }}>
            Testimonials
          </span>
          <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: "#0f172a", letterSpacing: "-0.02em" }}>
            What parents &amp; educators say
          </h2>
          <p className="text-sm max-w-xl mx-auto" style={{ color: "#64748b", lineHeight: 1.6 }}>
            Real stories from families and institutions using MetryxOne
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.slice(0, 3).map((t, idx) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="rounded-2xl p-6 flex flex-col"
              style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
              data-testid={`testimonial-${t.id}`}
            >
              <div className="flex gap-0.5 mb-4">
                {[1,2,3,4,5].map((s) => (
                  <Star key={s} size={14} style={{ color: "#f59e0b", fill: "#f59e0b" }} />
                ))}
              </div>
              <p className="text-sm flex-1 mb-5" style={{ color: "#374151", lineHeight: 1.75, fontStyle: "italic" }}>
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="flex items-center gap-3 pt-4" style={{ borderTop: "1px solid #f1f5f9" }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0" style={{ backgroundColor: "#0B3C5D", fontWeight: 700 }}>
                  {t.avatar}
                </div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: "#0f172a" }}>{t.author}</div>
                  <div className="text-xs" style={{ color: "#64748b" }}>{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
        >
          {TESTIMONIALS.slice(3, 5).map((t, idx) => (
            <div
              key={t.id}
              className="rounded-2xl p-6 flex flex-col"
              style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
              data-testid={`testimonial-${t.id}`}
            >
              <div className="flex gap-0.5 mb-4">
                {[1,2,3,4,5].map((s) => (
                  <Star key={s} size={14} style={{ color: "#f59e0b", fill: "#f59e0b" }} />
                ))}
              </div>
              <p className="text-sm flex-1 mb-5" style={{ color: "#374151", lineHeight: 1.75, fontStyle: "italic" }}>
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="flex items-center gap-3 pt-4" style={{ borderTop: "1px solid #f1f5f9" }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0" style={{ backgroundColor: "#0B3C5D", fontWeight: 700 }}>
                  {t.avatar}
                </div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: "#0f172a" }}>{t.author}</div>
                  <div className="text-xs" style={{ color: "#64748b" }}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

const FAQ_ITEMS = [
  { id: "diagnostic", q: "Is MetryxOne a diagnostic tool?", a: "No. MetryxOne provides behavioral insights and patterns, not clinical diagnoses. We help identify learning and exam readiness patterns.", icon: Brain },
  { id: "duration", q: "How long does an assessment take?", a: "ExamReadiness Index™ takes 30-40 minutes. LBI™ modules vary from 15-45 minutes. You can pause and resume anytime.", icon: Clock },
  { id: "data-safety", q: "Is my child's data safe?", a: "Absolutely. DPDP Act compliant with explicit parental consent for minors. Data is encrypted and never sold.", icon: Shield },
  { id: "age-groups", q: "What age groups is this suitable for?", a: "Students aged 10-19+ with age-appropriate questions (L1: 10-12, L2: 13-15, L3: 16-18, L4: 19+).", icon: Users },
  { id: "schools", q: "Can schools use MetryxOne for all students?", a: "Yes! Institutional plans with bulk access, admin dashboards, cohort analytics, and no individual ranking.", icon: Building2 },
];

function FAQSection() {
  const [openId, setOpenId] = useState<string | null>(null);
  
  return (
    <section id="faq" className="py-8" style={{ backgroundColor: "#ffffff" }}>
      <div className="container mx-auto px-6 max-w-3xl">
        <motion.div 
          className="text-center mb-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl md:text-3xl mb-1 font-medium" style={{ color: "var(--text-primary)" }}>
            Common Questions
          </h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Quick answers to help you get started</p>
        </motion.div>

        <div className="space-y-2">
          {FAQ_ITEMS.map((faq) => (
            <motion.div
              key={faq.id}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-xl border overflow-hidden transition-all"
              style={{ 
                backgroundColor: openId === faq.id ? "var(--bg-secondary)" : "var(--bg-primary)", 
                borderColor: openId === faq.id ? "var(--accent-cyan)" : "var(--border-subtle)"
              }}
              data-testid={`faq-${faq.id}`}
            >
              <button
                onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
                className="w-full flex items-center gap-3 p-4 text-left group"
                data-testid={`faq-toggle-${faq.id}`}
              >
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                  style={{ 
                    backgroundColor: openId === faq.id ? "rgba(78,205,196,0.12)" : "rgba(11,60,93,0.06)",
                  }}
                >
                  <faq.icon size={16} style={{ color: openId === faq.id ? "#4ECDC4" : "#0B3C5D" }} />
                </div>
                <span className="flex-1 text-sm" style={{ color: "var(--text-primary)", fontWeight: 500 }}>{faq.q}</span>
                <ChevronRight 
                  size={18} 
                  style={{ 
                    color: "var(--text-muted)",
                    transform: openId === faq.id ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 0.2s"
                  }} 
                />
              </button>
              <AnimatePresence>
                {openId === faq.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="px-4 pb-4 pl-[60px]">
                      <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>{faq.a}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AnimatedCounter({ value, suffix, decimal, testId }: { value: number; suffix: string; decimal?: boolean; testId: string }) {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasAnimated || !ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const duration = 2000;
          const steps = 60;
          const increment = value / steps;
          let current = 0;
          const timer = setInterval(() => {
            current += increment;
            if (current >= value) {
              setCount(value);
              clearInterval(timer);
            } else {
              setCount(decimal ? Math.round(current * 10) / 10 : Math.floor(current));
            }
          }, duration / steps);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [hasAnimated, value, decimal]);

  const displayValue = decimal ? count.toFixed(1) : count.toLocaleString();

  return (
    <div ref={ref} className="text-lg text-white" style={{ fontWeight: 700, fontFamily: "'Inter', sans-serif", lineHeight: 1 }} data-testid={testId}>
      {displayValue}{suffix}
    </div>
  );
}

const VERTICALS = [
  {
    id: "schools",
    icon: GraduationCap,
    label: "Schools (K–12)",
    audience: ["School students (Class 6–12)", "Parents & caregivers", "Teachers & academic leaders", "Coaching centres & tuition platforms"],
    focus: ["Cognitive readiness profiling", "Exam execution intelligence", "Learning behaviour patterns", "Anxiety-aware assessment"],
    outcomes: [
      "Understand how students think under pressure",
      "Identify learning gaps beyond marks",
      "Guide preparation with AI-powered explanations",
      "Support student wellbeing alongside performance"
    ],
    tone: "Empathetic, scientific, non-judgmental"
  },
  {
    id: "campus",
    icon: Building2,
    label: "Colleges & Campus Hiring",
    audience: ["University students & final-year graduates", "Placement cells & TPOs", "Campus recruiters & hiring managers", "Skill development programmes"],
    focus: ["Campus-wide cognitive screening", "Role-fit & aptitude matching", "Placement readiness benchmarking", "Recruiter-ready candidate profiles"],
    outcomes: [
      "Run large-scale placement drives with cognitive data",
      "Match candidates to roles beyond resume screening",
      "Benchmark campus talent against industry standards",
      "Reduce time-to-hire with pre-assessed talent pools"
    ],
    tone: "Confident, data-driven, placement-focused"
  },
  {
    id: "employability",
    icon: Target,
    label: "Employability & Skill Readiness",
    audience: ["Job seekers & early-career professionals", "Upskilling & reskilling platforms", "Government skill missions (NSDC, PMKVY)", "Vocational training institutes"],
    focus: ["Decision-making under complexity", "Cognitive adaptability scoring", "Skill–role alignment mapping", "Workforce readiness indexing"],
    outcomes: [
      "Measure thinking ability, not just knowledge",
      "Identify high-potential traits for career growth",
      "Guide reskilling with personalised learning paths",
      "Reduce mismatch between talent and job roles"
    ],
    tone: "Empowering, analytical, future-ready"
  },
  {
    id: "enterprise",
    icon: Briefcase,
    label: "Enterprise & Corporate",
    audience: ["HR & talent acquisition teams", "L&D and organisational development", "CXOs & people analytics leaders", "Staffing & recruitment agencies"],
    focus: ["Behavioural profiling for hiring", "Leadership readiness assessment", "Team dynamics & culture-fit analysis", "Workforce performance intelligence"],
    outcomes: [
      "Hire based on cognitive potential, not just experience",
      "Build leadership pipelines with behavioural data",
      "Reduce attrition with culture-fit intelligence",
      "Drive workforce planning with real-time analytics"
    ],
    tone: "Authoritative, strategic, results-oriented"
  },
  {
    id: "competency",
    icon: Gauge,
    label: "Competency Intelligence",
    audience: ["Talent & L&D teams benchmarking roles", "HR leaders tracking workforce capability", "Individuals planning career transitions", "Hiring managers predicting candidate success"],
    focus: ["50-competency gap scoring vs industry cohorts", "Role-fit probability across 7 industries", "Career stage benchmarking (Entry → Leadership)", "Hiring prediction & growth simulation"],
    outcomes: [
      "Know exactly which competencies each person is missing",
      "Predict role-fit before hiring or promoting",
      "Simulate 6-month growth trajectories per domain",
      "Generate personalised learning paths by gap severity"
    ],
    tone: "Data-driven, precise, future-ready"
  }
];


const SERVICE_TAB_STEPS: Record<string, { step: number; icon: React.ElementType; title: string; tag: string; desc: string; id: string; color: string; bullets: string[]; output: string }[]> = {
  education: [
    { step: 1, icon: Users, title: "Register", tag: "~5 min", desc: "Create your profile and set up consent", id: "signup", color: "#0B3C5D", bullets: ["Parent or student registration", "Add child profiles easily", "DPDP-compliant consent flow"], output: "Account ready" },
    { step: 2, icon: Brain, title: "Assess", tag: "30–40 min", desc: "Adaptive intelligence assessment", id: "assess", color: "#4ECDC4", bullets: ["Adaptive questioning engine", "Cognitive pattern capture", "Pause & resume anytime"], output: "140+ data signals" },
    { step: 3, icon: BarChart3, title: "AI Analysis", tag: "< 2 sec", desc: "Deep pattern recognition & scoring", id: "analysis", color: "#0B3C5D", bullets: ["7-dimension behavioral mapping", "97 subdomain scoring", "Bias-corrected AI models"], output: "Intelligence profile" },
    { step: 4, icon: Target, title: "Act", tag: "Instant", desc: "Personalized intelligence report", id: "clarity", color: "#4ECDC4", bullets: ["Personalized learning roadmap", "Priority focus areas flagged", "AI-explained plain-language report"], output: "Actionable roadmap" },
  ],
  enterprise: [
    { step: 1, icon: Building2, title: "Configure", tag: "< 1 day", desc: "Enterprise platform setup & SSO", id: "onboard", color: "#0B3C5D", bullets: ["Admin dashboard provisioning", "SSO & API integration", "Role-based access control"], output: "Platform live" },
    { step: 2, icon: Users, title: "Deploy", tag: "20–30 min", desc: "Candidate & employee assessments", id: "profile", color: "#4ECDC4", bullets: ["Behavioral profiling at scale", "Role-specific assessment tracks", "Multi-batch scheduling"], output: "Behavioral profiles" },
    { step: 3, icon: Brain, title: "Map", tag: "Real-time", desc: "Talent intelligence & gap analysis", id: "mapping", color: "#0B3C5D", bullets: ["Competency vs role-fit scoring", "Growth potential signals", "Team compatibility matrix"], output: "Talent map" },
    { step: 4, icon: Target, title: "Decide", tag: "Continuous", desc: "Data-backed hiring & development", id: "hiring", color: "#4ECDC4", bullets: ["Ranked candidate recommendations", "Bias-mitigated decision support", "Workforce intelligence dashboard"], output: "Hiring intelligence" },
  ],
  institution: [
    { step: 1, icon: Building2, title: "Integrate", tag: "2–3 days", desc: "Institution onboarding & configuration", id: "setup", color: "#0B3C5D", bullets: ["Institution profile & branding", "Admin roles & hierarchies", "Academic calendar integration"], output: "Platform configured" },
    { step: 2, icon: Users, title: "Enroll", tag: "Bulk upload", desc: "Batch student & cohort onboarding", id: "enroll", color: "#4ECDC4", bullets: ["CSV or LMS bulk import", "Class-wise grouping & tagging", "Guardian consent automation"], output: "Cohort ready" },
    { step: 3, icon: Brain, title: "Assess", tag: "Scheduled", desc: "Structured class & cohort assessments", id: "cohort", color: "#0B3C5D", bullets: ["Proctored assessment sessions", "Age-adaptive item delivery", "Real-time completion tracking"], output: "Cohort data" },
    { step: 4, icon: Target, title: "Intervene", tag: "Auto-reports", desc: "Intelligence-driven planning & action", id: "planning", color: "#4ECDC4", bullets: ["Cohort-level analytics dashboard", "At-risk student signals", "Policy-aligned intervention reports"], output: "Action plan" },
  ],
  competency: [
    { step: 1, icon: Gauge, title: "Profile", tag: "~10 min", desc: "Select role, industry & career stage", id: "ci-profile", color: "#4ECDC4", bullets: ["50-competency profile setup", "7 industry cohort selection", "Entry / Mid / Senior / Leadership stage"], output: "Benchmark baseline" },
    { step: 2, icon: BarChart3, title: "Benchmark", tag: "Real-time", desc: "Score against live industry cohorts", id: "ci-benchmark", color: "#4ECDC4", bullets: ["Percentile ranking vs peers", "Gap severity scoring per competency", "Industry-adjusted performance bands"], output: "Gap map" },
    { step: 3, icon: GitMerge, title: "Predict", tag: "Instant", desc: "Role-fit probability & hiring signals", id: "ci-predict", color: "#0B3C5D", bullets: ["Role-fit probability score (0–100%)", "Career readiness rating", "Candidate match ranking"], output: "Hiring prediction" },
    { step: 4, icon: Lightbulb, title: "Grow", tag: "Continuous", desc: "Personalised learning paths by gap priority", id: "ci-grow", color: "#f59e0b", bullets: ["6-month growth simulation", "Priority-ranked interventions", "Domain-level growth trajectories"], output: "Growth roadmap" },
  ],
};

const CLARITY_LINES = [
  {
    prefix: "Science-backed behavioral profiling across",
    highlight: "19 intelligence domains.",
    subtext: "MetryxOne maps cognitive patterns, learning behaviors, and performance signals into actionable intelligence — for schools, campuses, and enterprises.",
    vertical: "Schools & Coaching",
  },
  {
    prefix: "Precision beyond marks and resumes.",
    highlight: "Intelligence that predicts performance.",
    subtext: "Understand thinking style, exam readiness, and focus patterns — the behavioral signals that academic scores and GPAs miss entirely.",
    vertical: "Schools & Coaching",
  },
  {
    prefix: "Campus-grade cognitive screening.",
    highlight: "Placement accuracy at scale.",
    subtext: "MetryxOne helps placement cells and recruiters screen, rank, and match candidates using behavioral signals — not just CGPA or interview impressions.",
    vertical: "Campus & Placement",
  },
  {
    prefix: "Talent intelligence that goes beyond the CV.",
    highlight: "Hire for cognitive potential.",
    subtext: "Build high-performing teams with behavioral profiles that reveal decision-making, adaptability, and leadership readiness before day one.",
    vertical: "Enterprise & Corporate",
  },
  {
    prefix: "Institution-wide learning intelligence.",
    highlight: "Actionable insights for every cohort.",
    subtext: "Give educators and academic leaders the behavioral data to identify struggling learners, gifted students, and systemic gaps across grade levels.",
    vertical: "Schools & Coaching",
  },
  {
    prefix: "Workforce readiness is a measurable signal.",
    highlight: "MetryxOne quantifies it at scale.",
    subtext: "Index thinking quality, adaptability, and role-alignment for job seekers, skilling platforms, and government workforce programs with a single intelligence layer.",
    vertical: "Employability & Skilling",
  },
  {
    prefix: "50 competencies benchmarked across 7 industries.",
    highlight: "Know precisely where every person stands.",
    subtext: "The Competency Intelligence Platform maps gap severity, role-fit probability, and growth trajectory — so hiring, development, and transitions are driven by data, not instinct.",
    vertical: "Competency Intelligence",
  },
];

const IntelligenceFrameworkPanel = memo(({ onNavigate }: { onNavigate: (s: Screen) => void }) => {
  const [activeFramework, setActiveFramework] = useState<"lbi" | "exam" | "competency">("lbi");

  const frameworks = [
    { id: "lbi" as const, label: "LBI™", sublabel: "Learning Behavior Index", icon: Brain, stats: ["19 Domains", "97 Subdomains", "7 Modules"], accent: "#0B3C5D" },
    { id: "exam" as const, label: "ERI™", sublabel: "Exam Readiness Index", icon: Sparkles, stats: ["6 Dimensions", "24 Indicators", "3 Stages"], accent: "#4ECDC4" },
    { id: "competency" as const, label: "CIP™", sublabel: "Competency Intelligence", icon: Gauge, stats: ["50 Competencies", "7 Industries", "4 Stages"], accent: "#4ECDC4" },
  ];

  const BRAND = ["#0B3C5D", "#4ECDC4", "#2A6496", "#4ECDC4", "#1B3F6E", "#3B7AB0", "#33B4AE"];

  const lbiModules = [
    { code: "M1", name: "Cognitive Core", domains: 2, subs: 14, score: 75, color: BRAND[0] },
    { code: "M2", name: "Emotional Regulation", domains: 3, subs: 22, score: 68, color: BRAND[1] },
    { code: "M3", name: "Social & Behavioural", domains: 3, subs: 14, score: 73, color: BRAND[2] },
    { code: "M4", name: "Drive & Environment", domains: 2, subs: 9, score: 68, color: BRAND[3] },
    { code: "M5", name: "Performance & Planning", domains: 3, subs: 15, score: 76, color: BRAND[4] },
    { code: "M6", name: "Self-Awareness", domains: 3, subs: 11, score: 65, color: BRAND[5] },
    { code: "M7", name: "Adaptability", domains: 3, subs: 12, score: 66, color: BRAND[6] },
  ];

  const examDimensions = [
    { code: "E1", name: "Cognitive Preparedness", indicators: 5, score: 78, color: BRAND[0] },
    { code: "E2", name: "Stress & Anxiety Management", indicators: 4, score: 61, color: BRAND[1] },
    { code: "E3", name: "Exam Execution Strategy", indicators: 4, score: 83, color: BRAND[2] },
    { code: "E4", name: "Focus & Attention Control", indicators: 4, score: 70, color: BRAND[3] },
    { code: "E5", name: "Recovery & Resilience", indicators: 4, score: 65, color: BRAND[4] },
    { code: "E6", name: "Self-Belief & Motivation", indicators: 3, score: 72, color: BRAND[5] },
  ];

  const competencyGroups = [
    { code: "CG1", name: "Leadership & Influence", competencies: 8, avgScore: 71, color: BRAND[0] },
    { code: "CG2", name: "Analytical & Decision-Making", competencies: 7, avgScore: 68, color: BRAND[1] },
    { code: "CG3", name: "Communication & Collaboration", competencies: 9, avgScore: 74, color: BRAND[2] },
    { code: "CG4", name: "Innovation & Adaptability", competencies: 7, avgScore: 63, color: BRAND[3] },
    { code: "CG5", name: "Execution & Delivery", competencies: 8, avgScore: 79, color: BRAND[4] },
    { code: "CG6", name: "Commercial & Strategic Acumen", competencies: 6, avgScore: 66, color: BRAND[5] },
    { code: "CG7", name: "People & Culture Alignment", competencies: 5, avgScore: 72, color: BRAND[6] },
  ];

  const activeF = frameworks.find(f => f.id === activeFramework)!;
  const rows = activeFramework === "lbi" ? lbiModules : activeFramework === "exam" ? examDimensions : competencyGroups;

  return (
    <motion.div
      className="rounded-xl overflow-hidden border flex flex-col flex-1"
      style={{ borderColor: "rgba(11,60,93,0.15)", boxShadow: "0 4px 24px rgba(11,60,93,0.08)" }}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      data-testid="intelligence-framework-panel"
    >
      {/* Header — white */}
      <div className="px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b" style={{ backgroundColor: "#FFFFFF", borderColor: "rgba(11,60,93,0.10)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: "rgba(78,205,196,0.12)", border: "1px solid rgba(78,205,196,0.25)" }}>
            <Layers size={14} style={{ color: "#4ECDC4" }} />
          </div>
          <div>
            <span className="text-xs font-semibold" style={{ color: "#4ECDC4" }}>MetryxOne</span>
            <span className="text-sm font-medium ml-2" style={{ color: "#0B3C5D" }}>Intelligence Frameworks</span>
          </div>
        </div>
        {/* Framework Selector Tabs */}
        <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ backgroundColor: "rgba(11,60,93,0.05)", border: "1px solid rgba(11,60,93,0.10)" }}>
          {frameworks.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFramework(f.id)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all"
              style={{
                backgroundColor: activeFramework === f.id ? f.accent : "transparent",
                color: activeFramework === f.id ? "#FFFFFF" : "#64748b",
              }}
            >
              <f.icon size={11} />
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-header: Framework name + stats */}
      <div className="px-4 py-2 flex flex-wrap items-center justify-between gap-2 border-b" style={{ backgroundColor: "#f8fafc", borderColor: "rgba(11,60,93,0.08)" }}>
        <div className="flex items-center gap-2">
          <activeF.icon size={13} style={{ color: activeF.accent }} />
          <span className="text-xs font-normal" style={{ color: activeF.accent }}>{activeF.sublabel}</span>
          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, backgroundColor: `${activeF.accent}12`, color: activeF.accent, fontWeight: 500 }}>Science-backed</span>
        </div>
        <div className="flex items-center gap-3">
          {activeF.stats.map((s, i) => (
            <span key={i} className="text-xs font-normal" style={{ color: "#64748b" }}>{s}</span>
          ))}
          <button
            onClick={() => onNavigate(activeFramework === "lbi" ? "lbi-product" : activeFramework === "exam" ? "exam-ready" : "competency-intelligence")}
            className="text-xs font-normal flex items-center gap-1 px-2 py-1 rounded transition-all hover:opacity-80"
            style={{ backgroundColor: `${activeF.accent}12`, color: activeF.accent }}
          >
            Explore <ArrowRight size={9} />
          </button>
        </div>
      </div>

      {/* Split body: bar chart left · text list right */}
      {(() => {
        const avg = Math.round(rows.reduce((s, r: any) => s + (r.score ?? r.avgScore ?? 70), 0) / rows.length);
        return (
          <div className="flex flex-1" style={{ backgroundColor: "#FFFFFF" }}>

            {/* ── LEFT: bar chart ── */}
            <div className="p-4 flex flex-col flex-1" style={{ borderRight: "1px solid rgba(11,60,93,0.07)", width: "48%", flexShrink: 0 }}>
              <p className="text-xs font-normal mb-3" style={{ color: "#94a3b8" }}>
                Module scores
              </p>

              <div className="flex items-end gap-1 flex-1" style={{ minHeight: 120 }}>
                {/* Y-axis */}
                <div className="flex flex-col justify-between pb-6 pr-1 flex-shrink-0" style={{ height: 130 }}>
                  {[100, 50].map(v => (
                    <span key={v} className="block text-right leading-none"
                      style={{ color: "rgba(11,60,93,0.35)", fontSize: 11, fontWeight: 400 }}>{v}</span>
                  ))}
                </div>

                {/* Bars column */}
                <div className="flex-1 flex flex-col">
                  <div className="relative" style={{ height: 130 }}>
                    {/* Guide lines */}
                    <div className="absolute inset-x-0" style={{ bottom: "50%", borderTop: "1px dashed rgba(11,60,93,0.08)" }} />
                    <div className="absolute inset-x-0 bottom-0" style={{ borderTop: "1.5px solid rgba(11,60,93,0.15)" }} />

                    {/* Bars */}
                    <div className="absolute bottom-0 inset-x-0 flex items-end gap-1">
                      {rows.map((row) => {
                        const r = row as any;
                        const score: number = r.score ?? r.avgScore ?? 70;
                        const color: string = r.color;
                        const barH = Math.round((score / 100) * 118);
                        return (
                          <div key={r.code} className="flex-1 flex flex-col items-center justify-end">
                            <span className="leading-none mb-1"
                              style={{ color, fontSize: 11, fontWeight: 400 }}>{score}%</span>
                            <motion.div
                              className="w-full rounded-t-sm"
                              style={{ backgroundColor: color, minHeight: 2 }}
                              initial={{ height: 0 }}
                              animate={{ height: barH }}
                              transition={{ duration: 0.55, delay: 0.05 * rows.indexOf(row), ease: "easeOut" }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* X-axis module codes */}
                  <div className="flex gap-1 mt-1.5">
                    {rows.map((row) => {
                      const r = row as any;
                      return (
                        <div key={r.code} className="flex-1 text-center">
                          <span className="block font-normal leading-none"
                            style={{ color: r.color, fontSize: 11 }}>{r.code}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Composite */}
              <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: "1px solid rgba(11,60,93,0.07)" }}>
                <span style={{ color: "#64748b", fontSize: 11 }}>Composite</span>
                <span className="font-medium tabular-nums" style={{ color: activeF.accent, fontSize: 17 }}>
                  {avg}<span style={{ fontSize: 11, fontWeight: 400, opacity: 0.7 }}>%</span>
                </span>
              </div>
            </div>

            {/* ── RIGHT: module list ── */}
            <div className="flex-1 p-4 flex flex-col">
              <p className="text-xs font-normal mb-3" style={{ color: "#94a3b8" }}>
                {activeFramework === "lbi" ? "7 modules" : activeFramework === "exam" ? "6 dimensions" : "7 groups"}
              </p>

              <div className="space-y-2 flex-1">
                {rows.map((row) => {
                  const r = row as any;
                  const score: number = r.score ?? r.avgScore ?? 70;
                  const color: string = r.color;
                  return (
                    <div key={r.code} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-normal px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{ backgroundColor: `${color}15`, color }}>{r.code}</span>
                        <span className="text-xs font-normal truncate" style={{ color: "#1e293b" }}>{r.name}</span>
                      </div>
                      <span className="text-xs font-medium tabular-nums flex-shrink-0"
                        style={{ color }}>{score}<span style={{ fontSize: 10, opacity: 0.6 }}>%</span></span>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: "1px solid rgba(11,60,93,0.07)" }}>
                <span style={{ color: "#94a3b8", fontSize: 11 }}>Scores illustrative</span>
                <span className="font-normal" style={{ color: "#4ECDC4", fontSize: 11 }}>
                  {activeFramework === "lbi" ? "50K+ profiled" : activeFramework === "exam" ? "exam-day precision" : "7 industries"}
                </span>
              </div>
            </div>
          </div>
        );
      })()}
    </motion.div>
  );
});

export function LandingPage({ onNavigate, deepLinkSessionId, deepLinkModalOpen, onReopenReport, onClearDeepLink }: LandingPageProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { scrollYProgress } = useScroll();
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [heroCardIdx, setHeroCardIdx] = useState(0);
  const HERO_CARD_COUNT = 5;
  const [trustOffset, setTrustOffset] = useState(0);
  const [expandedVertical, setExpandedVertical] = useState<string | null>(null);
  const [activeServiceTab, setActiveServiceTab] = useState<string>("education");
  const [pricingSegment, setPricingSegment] = useState<'individual' | 'institution' | 'enterprise'>('individual');
  const testimonialScrollRef = useRef<HTMLDivElement>(null);
  const [testimonialIndex, setTestimonialIndex] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setHeadlineIndex((prev) => (prev + 1) % ROTATING_HEADLINES.length);
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setHeroCardIdx((prev) => (prev + 1) % HERO_CARD_COUNT);
    }, 3800);
    return () => clearInterval(interval);
  }, []);

  const TRUST_ORGS = [
    { name: "DPS Group",        type: "School Chain"        },
    { name: "Narayana",         type: "Coaching Institute"  },
    { name: "IIT Delhi",        type: "Campus Placement"    },
    { name: "Infosys BPM",      type: "Enterprise HR"       },
    { name: "NSDC",             type: "Govt. Skill Mission" },
    { name: "Amity University", type: "Higher Education"    },
    { name: "Wipro",            type: "L&D Integration"     },
    { name: "Tata Consultancy", type: "Workforce Dev"       },
    { name: "Allen Institute",  type: "Coaching Chain"      },
    { name: "Manipal Group",    type: "University Network"  },
    { name: "HCL Technologies", type: "Enterprise L&D"      },
    { name: "FIITJEE",          type: "Test Prep"           },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setTrustOffset((prev) => (prev + 1) % TRUST_ORGS.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);


  useEffect(() => {
    const interval = setInterval(() => {
      setTestimonialIndex((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (testimonialScrollRef.current) {
      const cardWidth = 400;
      testimonialScrollRef.current.scrollTo({
        left: testimonialIndex * cardWidth,
        behavior: 'smooth'
      });
    }
  }, [testimonialIndex]);

  const scrollTestimonials = (direction: 'left' | 'right') => {
    if (direction === 'left') {
      setTestimonialIndex((prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);
    } else {
      setTestimonialIndex((prev) => (prev + 1) % TESTIMONIALS.length);
    }
  };

  useEffect(() => {
    const handleHashScroll = () => {
      const hash = window.location.hash.slice(1);
      if (hash) {
        const el = document.getElementById(hash);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    handleHashScroll();
    window.addEventListener('hashchange', handleHashScroll);
    return () => window.removeEventListener('hashchange', handleHashScroll);
  }, []);

  const fadeIn = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-100px" },
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] }
  } as const;

  const [showFreeAssessment, setShowFreeAssessment] = useState(false);
  const [assessmentPersona, setAssessmentPersona] = useState<'student' | 'teacher' | 'campus' | 'jobseeker' | 'parent' | 'professional' | undefined>(undefined);
  const [heroInitialConcern, setHeroInitialConcern] = useState<string | undefined>(undefined);
  const [heroInviteEmail, setHeroInviteEmail] = useState<string | undefined>(undefined);
  const [showPragati, setShowPragati] = useState(false);
  const [pragatiConcern, setPragatiConcern] = useState<string | undefined>(undefined);

  const handleEntryClick = () => {
    onNavigate('login');
  };

  const handleStartFreeAssessment = (persona?: 'student' | 'teacher' | 'campus' | 'jobseeker' | 'parent' | 'professional') => {
    setAssessmentPersona(persona);
    setHeroInitialConcern(undefined);
    setShowFreeAssessment(true);
    if (deepLinkSessionId) onClearDeepLink?.();
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      setHeroInitialConcern(detail.concern || undefined);
      setHeroInviteEmail(detail.email || undefined);
      setAssessmentPersona(undefined);
      setShowFreeAssessment(true);
    };
    window.addEventListener('mx-open-assessment', handler);
    return () => window.removeEventListener('mx-open-assessment', handler);
  }, []);

  useEffect(() => {
    const handler = () => { setShowPragati(true); };
    window.addEventListener('metryx:open-coach', handler);
    return () => window.removeEventListener('metryx:open-coach', handler);
  }, []);


  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen mx-page-bg" style={{ color: "var(--text-secondary)", fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
      <FreeAssessmentModal open={showFreeAssessment} onOpenChange={(v) => { setShowFreeAssessment(v); if (!v) { setAssessmentPersona(undefined); setHeroInitialConcern(undefined); setHeroInviteEmail(undefined); } }} onNavigate={(s: string) => onNavigate(s as Screen)} initialPersona={assessmentPersona} initialConcern={heroInitialConcern} initialEmail={heroInviteEmail} />
      <PragatiWorkspace
        open={showPragati}
        onClose={() => { setShowPragati(false); setPragatiConcern(undefined); }}
        initialConcern={pragatiConcern}
        onNavigate={(s: string) => onNavigate(s as Screen)}
        onStartAssessment={(concern) => {
          setShowPragati(false);
          setHeroInitialConcern(concern);
          setAssessmentPersona(undefined);
          setShowFreeAssessment(true);
        }}
      />
      <Navbar onNavigate={onNavigate} currentScreen="landing" />

      {/* ── Report-ready sticky banner (deep-link session persisted in sessionStorage) ── */}
      <AnimatePresence>
        {deepLinkSessionId && !deepLinkModalOpen && (
          <motion.div
            key="report-banner"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'fixed',
              top: '60px',
              left: 0,
              right: 0,
              zIndex: 40,
              background: 'linear-gradient(90deg, #344E86 0%, #1E2B4A 100%)',
              borderBottom: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <div className="flex items-center justify-center gap-3 px-4 py-2.5 max-w-7xl mx-auto">
              <span
                className="flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.15)' }}
              >
                <FileText size={13} style={{ color: '#A5B4FC' }} />
              </span>
              <p className="text-sm font-medium" style={{ color: '#E0E7FF', margin: 0 }}>
                Your CAPADEX report is ready to view
              </p>
              <button
                onClick={() => onReopenReport?.()}
                className="flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-full transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.18)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.25)',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.28)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.18)')}
              >
                View report
              </button>
              <button
                onClick={() => onClearDeepLink?.()}
                aria-label="Dismiss"
                className="flex-shrink-0 p-1 rounded-full transition-colors"
                style={{ color: 'rgba(255,255,255,0.55)', cursor: 'pointer', background: 'transparent', border: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HERO SECTION */}
      <section className="relative pt-20 pb-14 overflow-hidden" style={{ backgroundColor: "#ffffff" }}>
        {/* Subtle dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(11,60,93,0.07) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 50%, transparent 100%)",
            maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 50%, transparent 100%)",
          }}
        />

        <div className="container relative z-10 px-6 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center" data-hero-grid>

            {/* ── LEFT COLUMN ── */}
            <div className="min-w-0">

              {/* Badge pill */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mb-6"
              >
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold" style={{ backgroundColor: "rgba(11,60,93,0.08)", color: "#0B3C5D", border: "1px solid rgba(11,60,93,0.15)" }}>
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "#4ECDC4" }} />
                  CAPADEX Behavioral Intelligence Engine™
                </span>
              </motion.div>

              {/* Rotating headline */}
              <div className="min-h-[96px] mb-4" data-testid="rotating-headlines">
                <AnimatePresence mode="wait">
                  <motion.h1
                    key={headlineIndex}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.45 }}
                    className="text-3xl md:text-4xl lg:text-5xl leading-tight"
                    style={{ color: "#0f172a", fontWeight: 800, letterSpacing: "-0.025em" }}
                    data-testid={`headline-${headlineIndex}`}
                  >
                    {ROTATING_HEADLINES[headlineIndex]}
                  </motion.h1>
                </AnimatePresence>
              </div>

              {/* Subtext */}
              <div className="min-h-[48px] mb-8">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={`sub-${headlineIndex}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.35 }}
                    className="text-base md:text-lg max-w-lg"
                    style={{ color: "#475569", lineHeight: 1.65 }}
                  >
                    {CLARITY_LINES[headlineIndex].subtext}
                  </motion.p>
                </AnimatePresence>
              </div>

              {/* 2×2 mini feature cards */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="grid grid-cols-2 gap-3 mb-8"
              >
                {[
                  { icon: BarChart3,    title: "CSI Score",           desc: "Career Stage Index across 5 development levels" },
                  { icon: Brain,        title: "Behavioral Signals",  desc: "97-dimension profiling across 19 domains" },
                  { icon: Lightbulb,    title: "Growth Paths",        desc: "Personalised AI-driven learning journeys" },
                  { icon: Layers,       title: "Domain Analysis",     desc: "Deep intelligence per behavioral domain" },
                ].map((card) => (
                  <div
                    key={card.title}
                    className="flex items-start gap-3 p-3.5 rounded-xl"
                    style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(11,60,93,0.08)" }}>
                      <card.icon size={15} style={{ color: "#0B3C5D" }} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-0.5" style={{ color: "#0f172a" }}>{card.title}</p>
                      <p className="text-[11px]" style={{ color: "#64748b", lineHeight: 1.4 }}>{card.desc}</p>
                    </div>
                  </div>
                ))}
              </motion.div>

              {/* CTA buttons */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-wrap gap-3 mb-5"
              >
                <button
                  onClick={() => setShowFreeAssessment(true)}
                  className="px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:brightness-105 active:scale-95 flex items-center gap-2"
                  style={{ backgroundColor: "#4ECDC4", color: "#0f172a" }}
                  data-testid="hero-cta-assessment"
                >
                  Get My Stage Analysis
                  <ArrowRight size={16} />
                </button>
                <button
                  onClick={() => onNavigate('career-builder?tab=assessment' as Screen)}
                  className="px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:bg-gray-50 active:scale-95 flex items-center gap-2"
                  style={{ color: "#0B3C5D", border: "1.5px solid #0B3C5D", backgroundColor: "transparent" }}
                  data-testid="hero-cta-competency-assessment"
                >
                  Take Competency Assessment
                  <ChevronRight size={16} />
                </button>
                <button
                  onClick={() => onNavigate('request-demo')}
                  className="px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:bg-gray-50 active:scale-95 flex items-center gap-2"
                  style={{ color: "#0B3C5D", border: "1.5px solid #0B3C5D", backgroundColor: "transparent" }}
                  data-testid="hero-cta-primary"
                >
                  Request Enterprise Demo
                  <ChevronRight size={16} />
                </button>
              </motion.div>


              {/* Compliance trust line */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs"
                style={{ color: "#94a3b8" }}
              >
                {[
                  "DPDP & FERPA compliant",
                  "50 competencies · 7 industries",
                  "93% predictive accuracy",
                  "Enterprise-grade security",
                ].map((item) => (
                  <span key={item} className="flex items-center gap-1">
                    <CheckCircle size={11} style={{ color: "#4ECDC4" }} />
                    {item}
                  </span>
                ))}
              </motion.div>
            </div>

            {/* ── RIGHT COLUMN — Report Sample Carousel ── */}
            <motion.div
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="hidden lg:flex flex-col gap-3"
            >
              {/* Card viewport — fixed height */}
              <div className="relative overflow-hidden" style={{ height: 380 }}>
                <AnimatePresence mode="wait">
                  {/* ── Card 0: CAPADEX Stage Analysis ── */}
                  {heroCardIdx === 0 && (
                    <motion.div
                      key="capadex"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.45 }}
                      className="absolute inset-0 rounded-2xl overflow-hidden"
                      style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}
                    >
                      <div className="px-5 pt-4 pb-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <div>
                            <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#4ECDC4" }}>CAPADEX</p>
                            <p className="text-sm font-semibold" style={{ color: "#0f172a" }}>Stage Analysis Report</p>
                            <p className="text-[11px]" style={{ color: "#64748b" }}>Product Manager · Technology</p>
                          </div>
                          <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(78,205,196,0.1)", color: "#0B3C5D" }}>Mid-Level · 2–5 yrs</span>
                        </div>
                        <div className="flex mt-3" style={{ borderBottom: "1px solid #e2e8f0" }}>
                          {["Junior", "Mid-Level", "Senior", "Lead / Principal"].map((tab, i) => (
                            <span key={tab} className="text-xs px-3 py-2 font-medium cursor-default" style={{ borderBottom: i === 1 ? "2px solid #4ECDC4" : "2px solid transparent", color: i === 1 ? "#4ECDC4" : "#94a3b8", marginBottom: -1 }}>{tab}</span>
                          ))}
                        </div>
                      </div>
                      <div className="px-5 py-3">
                        <div className="flex items-baseline gap-2 mb-3">
                          <span className="text-4xl font-extrabold" style={{ color: "#0f172a" }}>67</span>
                          <span className="text-sm" style={{ color: "#64748b" }}>Role Fit Score</span>
                        </div>
                        <p className="text-[10px] font-semibold mb-2.5 tracking-wider uppercase" style={{ color: "#94a3b8" }}>Stage-Calibrated Factors</p>
                        <div className="space-y-2">
                          {[
                            { name: "Strategic Thinking", score: 52 },
                            { name: "Technical Depth", score: 84 },
                            { name: "Communication", score: 71 },
                            { name: "People Leadership", score: 38 },
                            { name: "Stakeholder Influence", score: 63 },
                          ].map((f, fi) => (
                            <div key={f.name}>
                              <div className="flex justify-between mb-0.5">
                                <span className="text-[11px]" style={{ color: "#475569" }}>{f.name}</span>
                                <span className="text-[11px] font-bold" style={{ color: "#0f172a" }}>{f.score}</span>
                              </div>
                              <div className="h-1.5 rounded-full" style={{ backgroundColor: "#f1f5f9" }}>
                                <motion.div className="h-full rounded-full" style={{ backgroundColor: f.score >= 70 ? "#4ECDC4" : f.score >= 50 ? "#94a3b8" : "#f59e0b" }} initial={{ width: 0 }} animate={{ width: `${f.score}%` }} transition={{ duration: 0.9, delay: 0.3 + fi * 0.08, ease: "easeOut" }} />
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-2.5" style={{ borderTop: "1px solid #f1f5f9" }}>
                          <span className="text-[10px]" style={{ color: "#94a3b8" }}>Demo data — yours is private</span>
                          <button onClick={() => setShowFreeAssessment(true)} className="text-[11px] font-semibold flex items-center gap-1 hover:underline" style={{ color: "#4ECDC4" }}>See mine <ChevronRight size={12} /></button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* ── Card 1: LBI — Learning Behaviour Index ── */}
                  {heroCardIdx === 1 && (
                    <motion.div
                      key="lbi"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.45 }}
                      className="absolute inset-0 rounded-2xl overflow-hidden"
                      style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}
                    >
                      <div className="px-5 pt-4 pb-3">
                        <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: "#6366f1" }}>LBI</p>
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-semibold" style={{ color: "#0f172a" }}>Learning Behaviour Index</p>
                            <p className="text-[11px]" style={{ color: "#64748b" }}>Amara K. · Grade 10 · Age 15</p>
                          </div>
                          <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(99,102,241,0.08)", color: "#6366f1" }}>Reflective Learner</span>
                        </div>

                        {/* Ring + dimensions */}
                        <div className="flex items-center gap-5 mt-3">
                          {/* SVG ring */}
                          <div className="relative shrink-0" style={{ width: 96, height: 96 }}>
                            <svg width="96" height="96" viewBox="0 0 96 96">
                              <circle cx="48" cy="48" r="38" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                              <motion.circle cx="48" cy="48" r="38" fill="none" stroke="#6366f1" strokeWidth="8" strokeLinecap="round"
                                strokeDasharray={`${2 * Math.PI * 38}`}
                                initial={{ strokeDashoffset: 2 * Math.PI * 38 }}
                                animate={{ strokeDashoffset: 2 * Math.PI * 38 * (1 - 0.78) }}
                                transition={{ duration: 1.2, delay: 0.2, ease: "easeOut" }}
                                transform="rotate(-90 48 48)"
                              />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-xl font-extrabold" style={{ color: "#0f172a" }}>78</span>
                              <span className="text-[9px]" style={{ color: "#94a3b8" }}>/ 100</span>
                            </div>
                          </div>
                          {/* Dimension bars */}
                          <div className="flex-1 space-y-2">
                            {[
                              { name: "Persistence",   score: 82, color: "#6366f1" },
                              { name: "Attention",     score: 65, color: "#8b5cf6" },
                              { name: "Adaptability",  score: 88, color: "#6366f1" },
                              { name: "Velocity",      score: 59, color: "#a78bfa" },
                              { name: "Consistency",   score: 74, color: "#6366f1" },
                            ].map((d, di) => (
                              <div key={d.name}>
                                <div className="flex justify-between mb-0.5">
                                  <span className="text-[10px]" style={{ color: "#475569" }}>{d.name}</span>
                                  <span className="text-[10px] font-bold" style={{ color: "#0f172a" }}>{d.score}</span>
                                </div>
                                <div className="h-1.5 rounded-full" style={{ backgroundColor: "#f1f5f9" }}>
                                  <motion.div className="h-full rounded-full" style={{ backgroundColor: d.color }} initial={{ width: 0 }} animate={{ width: `${d.score}%` }} transition={{ duration: 0.8, delay: 0.3 + di * 0.07 }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Learning style chips */}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {["Spaced Repetition", "Visual Mapping", "Self-Quizzing"].map(s => (
                            <span key={s} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "rgba(99,102,241,0.08)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.15)" }}>{s}</span>
                          ))}
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-2.5" style={{ borderTop: "1px solid #f1f5f9" }}>
                          <span className="text-[10px]" style={{ color: "#94a3b8" }}>Demo data — yours is private</span>
                          <button onClick={() => setShowFreeAssessment(true)} className="text-[11px] font-semibold flex items-center gap-1 hover:underline" style={{ color: "#6366f1" }}>See mine <ChevronRight size={12} /></button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* ── Card 2: Competency Proficiency Map ── */}
                  {heroCardIdx === 2 && (
                    <motion.div
                      key="competency"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.45 }}
                      className="absolute inset-0 rounded-2xl overflow-hidden"
                      style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}
                    >
                      <div className="px-5 pt-4 pb-3">
                        <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: "#f59e0b" }}>Competency</p>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="text-sm font-semibold" style={{ color: "#0f172a" }}>Proficiency Map</p>
                            <p className="text-[11px]" style={{ color: "#64748b" }}>Software Engineer · Full-Stack</p>
                          </div>
                          <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(245,158,11,0.1)", color: "#b45309" }}>Overall: Proficient</span>
                        </div>

                        {/* Competency grid */}
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { name: "Problem Solving",    level: "Advanced",    pct: 85, color: "#4ECDC4" },
                            { name: "System Design",      level: "Proficient",  pct: 72, color: "#4ECDC4" },
                            { name: "Code Quality",       level: "Advanced",    pct: 88, color: "#4ECDC4" },
                            { name: "Collaboration",      level: "Proficient",  pct: 74, color: "#4ECDC4" },
                            { name: "Delivery Focus",     level: "Developing",  pct: 48, color: "#f59e0b" },
                            { name: "Tech Leadership",    level: "Emerging",    pct: 31, color: "#ef4444" },
                          ].map((c, ci) => (
                            <div key={c.name} className="p-2.5 rounded-lg" style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] font-medium" style={{ color: "#475569" }}>{c.name}</span>
                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: c.pct >= 70 ? "rgba(78,205,196,0.12)" : c.pct >= 50 ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.1)", color: c.pct >= 70 ? "#0B3C5D" : c.pct >= 50 ? "#b45309" : "#dc2626" }}>{c.level}</span>
                              </div>
                              <div className="h-1 rounded-full" style={{ backgroundColor: "#e2e8f0" }}>
                                <motion.div className="h-full rounded-full" style={{ backgroundColor: c.color }} initial={{ width: 0 }} animate={{ width: `${c.pct}%` }} transition={{ duration: 0.8, delay: 0.2 + ci * 0.06 }} />
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-2.5" style={{ borderTop: "1px solid #f1f5f9" }}>
                          <span className="text-[10px]" style={{ color: "#94a3b8" }}>Demo data — yours is private</span>
                          <button onClick={() => setShowFreeAssessment(true)} className="text-[11px] font-semibold flex items-center gap-1 hover:underline" style={{ color: "#f59e0b" }}>See mine <ChevronRight size={12} /></button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* ── Card 3: SDI — Strengths & Drivers ── */}
                  {heroCardIdx === 3 && (
                    <motion.div
                      key="sdi"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.45 }}
                      className="absolute inset-0 rounded-2xl overflow-hidden"
                      style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}
                    >
                      <div className="px-5 pt-4 pb-3">
                        <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: "#ec4899" }}>SDI</p>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="text-sm font-semibold" style={{ color: "#0f172a" }}>Strengths & Drivers Index</p>
                            <p className="text-[11px]" style={{ color: "#64748b" }}>Rishaan D. · Age 16 · CBSE Grade 11</p>
                          </div>
                          <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(236,72,153,0.08)", color: "#be185d" }}>Explorer Profile</span>
                        </div>

                        {/* Domain heatmap */}
                        <p className="text-[10px] font-semibold mb-2 tracking-wider uppercase" style={{ color: "#94a3b8" }}>Domain Intensity Map</p>
                        <div className="space-y-2">
                          {[
                            { domain: "Cognitive", subs: [{ name: "Reasoning", val: 88 }, { name: "Memory", val: 72 }, { name: "Processing", val: 65 }, { name: "Creativity", val: 91 }] },
                            { domain: "Emotional", subs: [{ name: "Self-Aware", val: 58 }, { name: "Regulation", val: 44 }, { name: "Empathy", val: 76 }, { name: "Resilience", val: 52 }] },
                            { domain: "Social",    subs: [{ name: "Leadership", val: 69 }, { name: "Teamwork", val: 83 }, { name: "Comm.", val: 77 }, { name: "Conflict Res.", val: 41 }] },
                          ].map((row) => (
                            <div key={row.domain}>
                              <p className="text-[10px] font-semibold mb-1" style={{ color: "#64748b" }}>{row.domain}</p>
                              <div className="grid grid-cols-4 gap-1">
                                {row.subs.map((s) => {
                                  const bg = s.val >= 80 ? "rgba(236,72,153,0.18)" : s.val >= 65 ? "rgba(236,72,153,0.09)" : s.val >= 50 ? "rgba(236,72,153,0.04)" : "#f8fafc";
                                  const tc = s.val >= 65 ? "#be185d" : "#94a3b8";
                                  return (
                                    <motion.div key={s.name} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35, delay: 0.2 }} className="rounded-lg p-1.5 text-center" style={{ backgroundColor: bg }}>
                                      <div className="text-[11px] font-bold" style={{ color: tc }}>{s.val}</div>
                                      <div className="text-[9px] leading-tight mt-0.5" style={{ color: "#94a3b8" }}>{s.name}</div>
                                    </motion.div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-2.5" style={{ borderTop: "1px solid #f1f5f9" }}>
                          <span className="text-[10px]" style={{ color: "#94a3b8" }}>Demo data — yours is private</span>
                          <button onClick={() => setShowFreeAssessment(true)} className="text-[11px] font-semibold flex items-center gap-1 hover:underline" style={{ color: "#ec4899" }}>See mine <ChevronRight size={12} /></button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* ── Card 4: CSI — Career Stage Index ── */}
                  {heroCardIdx === 4 && (
                    <motion.div
                      key="csi"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.45 }}
                      className="absolute inset-0 rounded-2xl overflow-hidden"
                      style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}
                    >
                      <div className="px-5 pt-4 pb-3">
                        <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: "#10b981" }}>CSI</p>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="text-sm font-semibold" style={{ color: "#0f172a" }}>Career Stage Index</p>
                            <p className="text-[11px]" style={{ color: "#64748b" }}>Priya M. · HR Manager · 6 yrs exp</p>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-extrabold" style={{ color: "#0f172a" }}>74</div>
                            <div className="text-[10px]" style={{ color: "#10b981" }}>Proficient</div>
                          </div>
                        </div>

                        {/* Stage meter */}
                        <p className="text-[10px] font-semibold mb-1.5 tracking-wider uppercase" style={{ color: "#94a3b8" }}>Stage Progression</p>
                        <div className="flex gap-1 mb-1">
                          {[
                            { label: "Forming",    max: 29,  active: false },
                            { label: "Emerging",   max: 49,  active: false },
                            { label: "Developing", max: 64,  active: false },
                            { label: "Proficient", max: 79,  active: true  },
                            { label: "Advanced",   max: 100, active: false },
                          ].map((s, si) => (
                            <div key={s.label} className="flex-1">
                              <motion.div className="h-2 rounded-full" style={{ backgroundColor: s.active ? "#10b981" : si < 3 ? "rgba(16,185,129,0.25)" : "#e2e8f0" }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.5, delay: 0.2 + si * 0.07, ease: "easeOut" }} />
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between mb-3">
                          {["Forming","Emerging","Developing","Proficient","Advanced"].map(s => (
                            <span key={s} className="text-[8px]" style={{ color: "#94a3b8" }}>{s}</span>
                          ))}
                        </div>

                        {/* Domain scores */}
                        <p className="text-[10px] font-semibold mb-2 tracking-wider uppercase" style={{ color: "#94a3b8" }}>Key Domains</p>
                        <div className="space-y-1.5">
                          {[
                            { name: "Emotional Intelligence", score: 81 },
                            { name: "Strategic Communication", score: 74 },
                            { name: "Adaptability",           score: 68 },
                            { name: "Digital Fluency",        score: 55 },
                          ].map((d, di) => (
                            <div key={d.name} className="flex items-center gap-2">
                              <span className="text-[10px] w-36 shrink-0" style={{ color: "#475569" }}>{d.name}</span>
                              <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: "#f1f5f9" }}>
                                <motion.div className="h-full rounded-full" style={{ backgroundColor: d.score >= 70 ? "#10b981" : "#94a3b8" }} initial={{ width: 0 }} animate={{ width: `${d.score}%` }} transition={{ duration: 0.8, delay: 0.4 + di * 0.08 }} />
                              </div>
                              <span className="text-[10px] font-bold w-6 text-right" style={{ color: "#0f172a" }}>{d.score}</span>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-2.5" style={{ borderTop: "1px solid #f1f5f9" }}>
                          <span className="text-[10px]" style={{ color: "#94a3b8" }}>Demo data — yours is private</span>
                          <button onClick={() => setShowFreeAssessment(true)} className="text-[11px] font-semibold flex items-center gap-1 hover:underline" style={{ color: "#10b981" }}>See mine <ChevronRight size={12} /></button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Dot indicators + engine label */}
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-semibold" style={{ color: ["#4ECDC4","#6366f1","#f59e0b","#ec4899","#10b981"][heroCardIdx] }}>
                  {["CAPADEX · Stage Analysis","LBI · Learning Behaviour Index","Competency · Proficiency Map","SDI · Strengths & Drivers","CSI · Career Stage Index"][heroCardIdx]}
                </span>
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: HERO_CARD_COUNT }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setHeroCardIdx(i)}
                      className="rounded-full transition-all"
                      style={{
                        width: i === heroCardIdx ? 18 : 6,
                        height: 6,
                        backgroundColor: i === heroCardIdx
                          ? ["#4ECDC4","#6366f1","#f59e0b","#ec4899","#10b981"][heroCardIdx]
                          : "#e2e8f0",
                      }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>



      {/* TRUST STRIP — 4-at-a-time auto-scroll */}
      <section className="py-4 border-b" style={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0" }} data-testid="trust-strip">
        <div className="container mx-auto px-6 max-w-5xl">
          <p className="text-center text-[10px] font-semibold mb-4 tracking-widest uppercase" style={{ color: "#94a3b8" }}>
            Trusted by leading institutions across education &amp; enterprise
          </p>

          {/* 4-visible sliding window */}
          <div className="overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={trustOffset}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.45, ease: "easeInOut" }}
                className="grid grid-cols-4 gap-px"
                style={{ backgroundColor: "#e2e8f0" }}
              >
                {[0, 1, 2, 3].map((slot) => {
                  const org = TRUST_ORGS[(trustOffset + slot) % TRUST_ORGS.length];
                  return (
                    <div
                      key={slot}
                      className="flex flex-col items-center justify-center py-4 px-6"
                      style={{ backgroundColor: "#ffffff" }}
                    >
                      <span className="text-sm font-bold" style={{ color: "#0f172a" }}>{org.name}</span>
                      <span className="text-[10px] mt-0.5" style={{ color: "#94a3b8" }}>{org.type}</span>
                    </div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-1 mt-3">
            {TRUST_ORGS.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === trustOffset ? 16 : 4,
                  height: 4,
                  backgroundColor: i === trustOffset ? "#4ECDC4" : "#e2e8f0",
                }}
              />
            ))}
          </div>
        </div>
      </section>


      {/* WHO IT'S BUILT FOR SECTION */}
      <section id="built-for" className="py-6 border-t" data-testid="built-for-section" style={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0" }}>
        <div className="container mx-auto px-6 max-w-6xl">

          {/* Header row */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[11px] font-semibold tracking-widest uppercase mb-0.5" style={{ color: "#94a3b8" }}>Built For</p>
              <h2 className="text-xl font-semibold" style={{ color: "#0f172a", letterSpacing: "-0.015em" }}>One platform. Five verticals.</h2>
            </div>
            <button
              onClick={handleEntryClick}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:brightness-105"
              style={{ backgroundColor: "#4ECDC4", color: "#0f172a" }}
              data-testid="explore-use-cases-cta"
            >
              <Sparkles className="w-3 h-3" />
              Explore use cases
            </button>
          </div>

          {/* Compact 5-column strip */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {VERTICALS.map((v, idx) => {
              const VIcon = v.icon;
              const accentColors = ["#4ECDC4", "#6366f1", "#f59e0b", "#ec4899", "#10b981"];
              const accent = accentColors[idx];
              return (
                <motion.div
                  key={v.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.06 }}
                  className="rounded-xl border p-4"
                  style={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0" }}
                  data-testid={`vertical-card-${v.id}`}
                >
                  {/* Icon + label */}
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: `${accent}14` }}>
                    <VIcon size={16} style={{ color: accent }} />
                  </div>
                  <p className="text-xs font-semibold mb-2.5 leading-snug" style={{ color: "#0f172a" }}>{v.label}</p>

                  {/* Focus chips */}
                  <div className="flex flex-col gap-1">
                    {v.focus.slice(0, 3).map((f, i) => (
                      <span key={i} className="text-[10px] leading-snug" style={{ color: "#64748b" }}>· {f}</span>
                    ))}
                  </div>

                  {/* Tone tag */}
                  <div className="mt-3 pt-2.5" style={{ borderTop: "1px solid #f1f5f9" }}>
                    <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: accent }}>{v.tone.split(",")[0]}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>

        </div>
      </section>


      {/* INTELLIGENCE FOR EDUCATION & WORKFORCE */}
      <section id="services" className="py-5 border-y" style={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0" }}>
        <div className="container mx-auto px-6 max-w-7xl">
          {/* Compact header */}
          <motion.div
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div>
              <span
                className="inline-block px-3 py-1 rounded-full text-xs mb-2"
                style={{ backgroundColor: "rgba(11,60,93,0.07)", color: "#0B3C5D", fontWeight: 600 }}
              >
                Beyond Snapshots
              </span>
              <h2
                className="text-2xl md:text-3xl font-medium"
                style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
              >
                Lifelong intelligence for every stage
              </h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif" }}>
                From student readiness to workforce potential — one unified platform
              </p>
            </div>
          </motion.div>

          {/* ── Row 1: Education + Workforce panels ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {[
              {
                icon: GraduationCap,
                iconBg: "var(--metryx-blue)",
                title: "Education intelligence",
                sub: "Students & parents",
                features: [
                  { label: "Exam readiness",     desc: "Psychological preparedness" },
                  { label: "Learning patterns",  desc: "Focus & cognitive style" },
                  { label: "Stress signals",     desc: "Anxiety & pressure indicators" },
                  { label: "Progress tracking",  desc: "Improvement over time" },
                ],
                cta: "Explore schools & coaching",
                slug: "k12-schools" as Screen,
                testId: "button-education-solutions",
                accent: "var(--metryx-blue)",
              },
              {
                icon: Briefcase,
                iconBg: "var(--accent-cyan)",
                title: "Workforce intelligence",
                sub: "Talent & enterprise",
                features: [
                  { label: "Talent signals",     desc: "High-potential candidates" },
                  { label: "Skill readiness",    desc: "Competency gap mapping" },
                  { label: "Growth trajectory",  desc: "Role adaptability & fit" },
                  { label: "Team dynamics",      desc: "Leadership & culture signals" },
                ],
                cta: "Explore enterprise solutions",
                slug: "enterprise-hiring" as Screen,
                testId: "button-workforce-solutions",
                accent: "var(--accent-cyan)",
              },
            ].map((panel, pi) => (
              <motion.div
                key={pi}
                className="p-5 rounded-xl border flex flex-col"
                style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-subtle)" }}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: pi * 0.08 }}
              >
                {/* Panel header */}
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(11,60,93,0.07)" }}>
                    <panel.icon size={17} style={{ color: "#0B3C5D" }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{panel.title}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{panel.sub}</p>
                  </div>
                </div>
                {/* Feature grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-4 flex-1">
                  {panel.features.map((f, fi) => (
                    <div key={fi} className="flex items-start gap-1.5">
                      <CheckCircle size={12} style={{ color: "var(--accent-cyan)", marginTop: 3, flexShrink: 0 }} />
                      <div>
                        <span className="block text-xs font-medium" style={{ color: "var(--text-primary)" }}>{f.label}</span>
                        <span className="block text-xs" style={{ color: "var(--text-secondary)" }}>{f.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* CTA */}
                <button
                  onClick={() => onNavigate(panel.slug)}
                  className="text-xs font-medium flex items-center gap-1 hover:gap-1.5 transition-all self-start"
                  style={{ color: panel.accent }}
                  data-testid={panel.testId}
                >
                  {panel.cta} <ChevronRight size={12} />
                </button>
              </motion.div>
            ))}
          </div>

          {/* ── Row 2: 3-service strip ── */}
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            {[
              { icon: Briefcase,     title: "Talent assessment",   desc: "Hire on cognitive potential, behavioral profiling & role-fit", stat: "10K+ hired",   statC: "var(--metryx-blue)", slug: "enterprise-hiring"   },
              { icon: GraduationCap, title: "Campus recruitment",  desc: "University-to-workforce pipelines with cognitive screening",   stat: "500+ drives",  statC: "var(--accent-cyan)", slug: "campus-recruit"      },
              { icon: BarChart3,     title: "Workforce analytics", desc: "Team performance, leadership readiness & skill gap mapping",   stat: "500+ teams",   statC: "var(--metryx-blue)", slug: "workforce-analytics" },
            ].map((item, idx) => (
              <button
                key={idx}
                onClick={() => onNavigate(item.slug as Screen)}
                className="flex items-start gap-3 p-4 rounded-xl border text-left transition-all hover:-translate-y-0.5 hover:shadow-sm group"
                style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-subtle)" }}
                data-testid={`enterprise-card-${item.slug}`}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: "rgba(11,60,93,0.08)" }}>
                  <item.icon size={15} style={{ color: "var(--metryx-blue)" }} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{item.title}</span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${item.statC === "var(--metryx-blue)" ? "rgba(11,60,93,0.08)" : "rgba(78,205,196,0.1)"}`, color: item.statC }}>{item.stat}</span>
                  </div>
                  <p className="text-xs leading-snug mb-2" style={{ color: "var(--text-secondary)" }}>{item.desc}</p>
                  <span className="text-xs font-medium flex items-center gap-0.5 group-hover:gap-1 transition-all" style={{ color: "var(--accent-cyan)" }}>
                    Learn more <ArrowRight size={11} />
                  </span>
                </div>
              </button>
            ))}
          </motion.div>

          {/* ── Row 3: Cognitive Signature™ — compact horizontal banner ── */}
          <motion.div
            className="rounded-xl border overflow-hidden mb-4"
            style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-subtle)" }}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            data-testid="card-cognitive-signature"
          >
            <div className="flex flex-col lg:flex-row">
              {/* Left: description + stats */}
              <div className="flex-1 p-5">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(11,60,93,0.07)" }}>
                    <Brain size={17} style={{ color: "#0B3C5D" }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Cognitive Signature™</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Unique to every individual</p>
                  </div>
                </div>
                <p className="text-sm mb-3" style={{ color: "var(--text-secondary)", lineHeight: 1.65 }}>
                  Every person has a unique cognitive fingerprint — how they process information, handle stress, and approach challenges. Our AI maps this signature to provide truly personalised guidance.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: "Pattern recognition", value: "7 dimensions",  id: "patterns"   },
                    { label: "Accuracy rate",        value: "94.2%",         id: "accuracy"   },
                    { label: "Processing time",      value: "< 2 sec",       id: "speed"      },
                    { label: "Data points",          value: "140+",          id: "datapoints" },
                  ].map((m) => (
                    <div key={m.id} className="p-2.5 rounded-lg" style={{ backgroundColor: "var(--bg-secondary)" }} data-testid={`metric-${m.id}`}>
                      <div className="text-xs mb-0.5" style={{ color: "var(--text-secondary)" }}>{m.label}</div>
                      <div className="text-sm font-semibold" style={{ color: "var(--accent-cyan)" }}>{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: preview panel */}
              <div className="lg:w-64 p-4 shrink-0" style={{ backgroundColor: "#f8fafc", borderLeft: "1px solid #e2e8f0" }}>
                <p className="text-xs font-medium mb-2.5" style={{ color: "#64748b" }}>Cognitive Signature preview</p>
                <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                  {[
                    { label: "Domains",     value: "19"   },
                    { label: "Subdomains",  value: "97"   },
                    { label: "Modules",     value: "7"    },
                    { label: "Data points", value: "140+" },
                  ].map((item, i) => (
                    <div key={i} className="p-2 rounded-md" style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0" }}>
                      <div className="text-[10px]" style={{ color: "#94a3b8" }}>{item.label}</div>
                      <div className="text-sm font-semibold" style={{ color: "#0f172a" }}>{item.value}</div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] mb-2" style={{ color: "#94a3b8" }}>Full 19-domain radar analysis available in report</p>
                <div className="flex items-center gap-1.5 pt-2" style={{ borderTop: "1px solid #e2e8f0" }}>
                  <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#4ECDC4" }} />
                  <span className="text-[11px]" style={{ color: "#64748b" }}>processing in real-time</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Row 4: Trust + philosophy strip (4 columns) ── */}
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-3"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            {[
              {
                icon: ShieldCheck,
                title: "Privacy-first design",
                desc: "DPDP Act compliant with parental consent. Data encrypted and never sold.",
                badges: ["DPDP Act", "ISO 27001", "GDPR Ready", "SOC 2"],
                testId: "trust-privacy",
              },
              {
                icon: Target,
                title: "Guidance, not labels",
                desc: "Actionable context — not diagnoses or rankings. Insights that empower.",
                live: "AI-guided recommendations active",
                testId: "trust-guidance",
              },
              {
                icon: Zap,
                title: "Real-time processing",
                desc: "Intelligence reports generated in under 2 seconds — no waiting, no batches.",
                stat: "< 2 sec",
                testId: "trust-speed",
              },
              {
                icon: CheckCircle,
                title: "Bias-corrected AI",
                desc: "Models trained on diverse cohorts with continuous fairness auditing.",
                stat: "93% accuracy",
                testId: "trust-bias",
              },
            ].map((card, ci) => (
              <div
                key={ci}
                className="p-4 rounded-xl border flex flex-col gap-2"
                style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-subtle)" }}
                data-testid={card.testId}
              >
                <card.icon size={17} style={{ color: "var(--accent-cyan)" }} />
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{card.title}</p>
                <p className="text-xs leading-snug flex-1" style={{ color: "var(--text-secondary)" }}>{card.desc}</p>
                {card.badges && (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {card.badges.map((b) => (
                      <span key={b} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }} data-testid={`badge-${b.toLowerCase().replace(/\s+/g, '-')}`}>{b}</span>
                    ))}
                  </div>
                )}
                {card.live && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: "var(--accent-cyan)" }} />
                    <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{card.live}</span>
                  </div>
                )}
                {card.stat && (
                  <span className="text-xs font-semibold mt-0.5" style={{ color: "var(--accent-cyan)" }}>{card.stat}</span>
                )}
              </div>
            ))}
          </motion.div>

          {/* ENTERPRISE + INTELLIGENCE — side-by-side halves */}
          <div className="mt-5 flex flex-col lg:flex-row gap-5 items-stretch">

          {/* LEFT HALF — Enterprise & Corporate Showcase */}
          <motion.div
            className="flex-1 min-w-0 p-6 rounded-2xl border"
            style={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0" }}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            data-testid="enterprise-showcase"
          >
            {/* Badge + headline + short body */}
            <span className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-3" style={{ backgroundColor: "rgba(78,205,196,0.1)", color: "#0B3C5D" }}>
              Enterprise & corporate
            </span>
            <h3 className="text-lg font-medium mb-1.5" style={{ color: "#0f172a" }}>
              Beyond Academics — Intelligence for the Workforce
            </h3>
            <p className="text-sm mb-4" style={{ color: "#64748b", lineHeight: 1.5 }}>
              Hire smarter, develop talent, and build high-performing teams — powered by the same cognitive science behind our education platform.
            </p>

            {/* Stats strip — 4 columns */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { value: "10K+", label: "Assessed", icon: Users },
                { value: "120+", label: "Clients", icon: Building2 },
                { value: "91%", label: "Hiring Accuracy", icon: Target },
                { value: "500+", label: "Campus Drives", icon: GraduationCap },
              ].map((stat, idx) => (
                <div key={idx} className="p-2.5 rounded-lg text-center" style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <span className="block text-base font-bold" style={{ color: "#0f172a" }}>{stat.value}</span>
                  <span className="block text-[11px] leading-tight mt-0.5" style={{ color: "#64748b" }}>{stat.label}</span>
                </div>
              ))}
            </div>

            {/* Service buttons — 2×2 */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { icon: Briefcase, label: "Talent Assessment", desc: "Hire beyond resumes with cognitive profiling", slug: "enterprise-hiring" },
                { icon: GraduationCap, label: "Campus Recruitment", desc: "University-to-workforce talent pipelines", slug: "campus-recruit" },
                { icon: BarChart3, label: "Workforce Analytics", desc: "Team performance & leadership readiness", slug: "workforce-analytics" },
                { icon: Users, label: "Employee Development", desc: "Personalized growth paths & reskilling", slug: "employee-development" },
              ].map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => onNavigate(item.slug as Screen)}
                  className="flex items-start gap-2 p-3 rounded-lg text-left transition-all hover:bg-gray-50"
                  style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}
                  data-testid={`enterprise-showcase-${item.slug}`}
                >
                  <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(11,60,93,0.07)" }}>
                    <item.icon size={14} style={{ color: "#0B3C5D" }} />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold" style={{ color: "#0f172a" }}>{item.label}</span>
                    <span className="block text-[11px] leading-snug" style={{ color: "#64748b" }}>{item.desc}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={() => onNavigate('enterprise-hiring' as Screen)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all hover:brightness-105"
              style={{ backgroundColor: "#4ECDC4", color: "#0f172a" }}
              data-testid="btn-explore-enterprise"
            >
              Explore Enterprise Solutions <ArrowRight size={16} />
            </button>
          </motion.div>

          {/* RIGHT HALF — Intelligence Frameworks Panel */}
          <div className="flex-1 min-w-0 flex flex-col">
            <IntelligenceFrameworkPanel onNavigate={onNavigate} />
          </div>

          </div>{/* end side-by-side row */}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-14" style={{ backgroundColor: "#ffffff" }}>
        <div className="container mx-auto px-6 max-w-6xl">
          {/* Header */}
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs mb-4" style={{ backgroundColor: "rgba(11,60,93,0.07)", color: "#0B3C5D", border: "1px solid rgba(11,60,93,0.12)" }}>
              <Zap size={11} />
              How it works
            </span>
            <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: "#0f172a", letterSpacing: "-0.025em" }}>
              How stage calibration works
            </h2>
            <p className="text-sm max-w-xl mx-auto" style={{ color: "#64748b", lineHeight: 1.65 }}>
              Three precise steps from onboarding to your calibrated behavioral intelligence report.
            </p>
          </motion.div>

          {/* 3 Numbered Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {([
              {
                num: "01",
                icon: Target,
                title: "Automatic Stage Detection",
                desc: "Answer 12 quick calibration questions. Our engine maps your behavioral signals to one of 4 career stages — Junior, Mid-Level, Senior, or Lead — in under 3 minutes.",
                tags: ["< 3 mins", "No resume needed", "Instant result"],
              },
              {
                num: "02",
                icon: BarChart3,
                title: "Stage-Specific P75 Benchmarks",
                desc: "Your responses are compared against peers at your exact career stage only — not everyone. Live cohort data across 19 behavioral domains drives every score.",
                tags: ["19 domains", "97 subdomains", "Live cohort data"],
              },
              {
                num: "03",
                icon: Brain,
                title: "Stage Transition Readiness",
                desc: "Get a calibrated gap report showing exactly what separates you from the next stage — with a time-to-promotion estimate and prioritised action steps.",
                tags: ["Gap report", "Promotion timeline", "Priority actions"],
              },
            ] as const).map((step, idx) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="relative p-6 rounded-2xl flex flex-col"
                style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
              >
                <span className="absolute top-5 right-6 text-5xl font-extrabold" style={{ color: "rgba(11,60,93,0.07)", letterSpacing: "-0.05em" }}>
                  {step.num}
                </span>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 shrink-0" style={{ backgroundColor: "rgba(11,60,93,0.07)" }}>
                  <step.icon size={18} style={{ color: "#0B3C5D" }} />
                </div>
                <h3 className="text-base font-semibold mb-2 pr-12" style={{ color: "#0f172a" }}>{step.title}</h3>
                <p className="text-sm flex-1 mb-4" style={{ color: "#64748b", lineHeight: 1.65 }}>{step.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {step.tags.map((tag) => (
                    <span key={tag} className="text-[11px] px-2.5 py-0.5 rounded-full" style={{ backgroundColor: "#f1f5f9", color: "#64748b" }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ORGANISATION SCROLL STRIP */}
      <div className="py-3 border-y overflow-hidden" style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-subtle)" }}>
        {/* Row 1 — left to right */}
        <div className="marquee-mask overflow-hidden mb-2">
          <div className="animate-marquee flex items-center gap-0" style={{ width: "max-content" }}>
            {([
              { name: "DPS Group",        type: "School Chain"       },
              { name: "Narayana",         type: "Coaching Institute" },
              { name: "IIT Delhi",        type: "Campus Placement"   },
              { name: "Infosys BPM",      type: "Enterprise HR"      },
              { name: "NSDC",             type: "Govt. Skill Mission" },
              { name: "Amity University", type: "Higher Education"   },
              { name: "Wipro",            type: "L&D Integration"    },
              { name: "DPS Group",        type: "School Chain"       },
              { name: "Narayana",         type: "Coaching Institute" },
              { name: "IIT Delhi",        type: "Campus Placement"   },
              { name: "Infosys BPM",      type: "Enterprise HR"      },
              { name: "NSDC",             type: "Govt. Skill Mission" },
              { name: "Amity University", type: "Higher Education"   },
              { name: "Wipro",            type: "L&D Integration"    },
            ]).map((org, i) => (
              <span key={i} className="inline-flex items-center gap-2 mx-4 shrink-0">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border" style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border-subtle)" }}>
                  <span className="text-[11px] font-medium" style={{ color: "var(--text-primary)" }}>{org.name}</span>
                  <span className="w-px h-3 self-center" style={{ backgroundColor: "var(--border-subtle)" }} />
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{org.type}</span>
                </span>
              </span>
            ))}
          </div>
        </div>

        {/* Row 2 — right to left (reverse) */}
        <div className="marquee-mask overflow-hidden">
          <div className="flex items-center gap-0" style={{ width: "max-content", animation: "marquee 36s linear infinite reverse" }}>
            {([
              { name: "Wipro",            type: "L&D Integration"    },
              { name: "Amity University", type: "Higher Education"   },
              { name: "NSDC",             type: "Govt. Skill Mission" },
              { name: "Infosys BPM",      type: "Enterprise HR"      },
              { name: "IIT Delhi",        type: "Campus Placement"   },
              { name: "Narayana",         type: "Coaching Institute" },
              { name: "DPS Group",        type: "School Chain"       },
              { name: "Wipro",            type: "L&D Integration"    },
              { name: "Amity University", type: "Higher Education"   },
              { name: "NSDC",             type: "Govt. Skill Mission" },
              { name: "Infosys BPM",      type: "Enterprise HR"      },
              { name: "IIT Delhi",        type: "Campus Placement"   },
              { name: "Narayana",         type: "Coaching Institute" },
              { name: "DPS Group",        type: "School Chain"       },
            ]).map((org, i) => (
              <span key={i} className="inline-flex items-center gap-2 mx-4 shrink-0">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border" style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border-subtle)" }}>
                  <span className="text-[11px] font-medium" style={{ color: "var(--text-primary)" }}>{org.name}</span>
                  <span className="w-px h-3 self-center" style={{ backgroundColor: "var(--border-subtle)" }} />
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{org.type}</span>
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* KEY FEATURES */}
      <section id="features" className="py-14" style={{ backgroundColor: "#ffffff" }}>
        <div className="container mx-auto px-6 max-w-7xl relative z-10">
          <motion.div
            className="flex flex-col items-center text-center gap-3 mb-6"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs"
              style={{ backgroundColor: "rgba(11,60,93,0.08)", color: "#0B3C5D", border: "1px solid rgba(11,60,93,0.15)" }}>
              <Layers size={11} />
              Intelligence suite
            </span>
            <h2 className="text-2xl md:text-3xl font-medium" style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
              The MetryxOne intelligence suite
            </h2>
            <div aria-hidden="true" style={{ width: 48, height: 2, borderRadius: 99, backgroundColor: "#0B3C5D" }} />
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Four frameworks. One behavioral intelligence platform.
            </p>
            <button
              onClick={() => onNavigate("competency-intelligence" as Screen)}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg transition-all hover:brightness-105 mt-1"
              style={{ backgroundColor: "#4ECDC4", color: "#0f172a" }}
            >
              Explore all frameworks <ArrowRight size={14} />
            </button>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {([
              {
                id: "lbi",
                num: "01",
                icon: Brain,
                title: "LBI™",
                subtitle: "Learning Behavior Index",
                desc: "19 intelligence domains that decode how each learner thinks, focuses, and performs — beyond marks.",
                features: ["7 behavior modules", "97 subdomains scored", "Cognitive & emotional", "Parent + teacher view"],
                badge: "Education",
                stat: "50K+",
                statLabel: "profiled",
                navigateTo: "lbi-product" as Screen,
                accentA: "#0B3C5D",
                accentB: "#4ECDC4",
              },
              {
                id: "exam-ready",
                num: "02",
                icon: Award,
                title: "ERI™",
                subtitle: "Exam Readiness Index",
                desc: "Predict exam-day performance from behavioral signals — stress response, focus, and preparation quality.",
                features: ["6 readiness dimensions", "Anxiety & stress signals", "Exam strategy scoring", "Pre-exam intervention"],
                badge: "Schools",
                stat: "83%",
                statLabel: "prediction accuracy",
                navigateTo: "exam-ready" as Screen,
                accentA: "#4ECDC4",
                accentB: "#0B3C5D",
              },
              {
                id: "cip",
                num: "03",
                icon: Gauge,
                title: "CIP™",
                subtitle: "Competency Intelligence",
                desc: "Benchmark professionals against live industry cohorts across 50 competencies and 7 sectors.",
                features: ["50 competencies mapped", "7 industry benchmarks", "Role-fit probability", "Hiring prediction score"],
                badge: "Enterprise",
                stat: "50",
                statLabel: "competencies",
                navigateTo: "competency-intelligence" as Screen,
                accentA: "#0B3C5D",
                accentB: "#4ECDC4",
              },
              {
                id: "reports",
                num: "04",
                icon: FileText,
                title: "AI Reports",
                subtitle: "Behavioral Intelligence Reports",
                desc: "Plain-language intelligence reports delivered in real time — for students, parents, HR, and educators.",
                features: ["Plain-language insights", "Priority action areas", "Multi-stakeholder views", "Reassessment tracking"],
                badge: "Live",
                stat: "< 2s",
                statLabel: "generation time",
                navigateTo: "ai-powered-reports" as Screen,
                accentA: "#4ECDC4",
                accentB: "#0B3C5D",
              },
            ]).map((f, idx) => (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.07 }}
                whileHover={{ y: -4, transition: { duration: 0.18 } }}
                onClick={() => onNavigate(f.navigateTo)}
                className="relative rounded-xl border flex flex-col group cursor-pointer overflow-hidden transition-all duration-200 hover:shadow-lg"
                style={{ backgroundColor: "var(--bg-primary)", borderColor: "rgba(11,60,93,0.12)" }}
                data-testid={`feature-${f.id}`}
              >
                {/* Top accent border */}
                <div
                  className="h-[2px] w-full shrink-0"
                  style={{ backgroundColor: "#e2e8f0" }}
                />

                <div className="p-4 flex flex-col gap-0 flex-1">

                  {/* Number + badge row */}
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className="text-[11px] font-medium tabular-nums"
                      style={{ color: "rgba(11,60,93,0.25)", letterSpacing: "0.04em" }}
                    >{f.num}</span>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${f.accentA}14`, color: f.accentA, border: `1px solid ${f.accentA}22` }}
                    >{f.badge}</span>
                  </div>

                  {/* Icon row */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 shrink-0"
                    style={{ backgroundColor: f.accentA }}
                  >
                    <f.icon size={18} color="#FFFFFF" />
                  </div>

                  {/* Title + subtitle */}
                  <p className="text-sm font-medium leading-tight" style={{ color: "var(--text-primary)" }}>{f.title}</p>
                  <p className="text-xs mt-0.5 mb-3" style={{ color: "var(--text-secondary)" }}>{f.subtitle}</p>

                  {/* Stat */}
                  <div className="flex items-baseline gap-1.5 mb-3">
                    <span className="text-2xl font-medium" style={{ color: f.accentA, letterSpacing: "-0.02em" }}>{f.stat}</span>
                    <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{f.statLabel}</span>
                  </div>

                  {/* Divider */}
                  <div className="mb-3" style={{ height: 1, backgroundColor: "rgba(11,60,93,0.07)" }} />

                  {/* Description */}
                  <p className="text-xs leading-relaxed mb-3 flex-1" style={{ color: "var(--text-secondary)" }}>
                    {f.desc}
                  </p>

                  {/* Features */}
                  <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 mb-4">
                    {f.features.map((item, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <CheckCircle size={11} className="shrink-0 mt-0.5" style={{ color: f.accentB }} />
                        <span className="text-[11px] leading-tight" style={{ color: "var(--text-secondary)" }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div
                  className="px-4 py-2.5 flex items-center justify-between"
                  style={{ borderTop: "1px solid rgba(11,60,93,0.07)" }}
                >
                  <span className="text-xs font-medium" style={{ color: f.accentA }}>Explore</span>
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center group-hover:translate-x-0.5 transition-transform"
                    style={{ backgroundColor: `${f.accentA}12` }}
                  >
                    <ChevronRight size={11} style={{ color: f.accentA }} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>


      {/* MENTOR MARKETPLACE + PLATFORM INTELLIGENCE SUITE — merged */}
      <LazySection>
      <section id="mentor-marketplace" className="py-6" style={{ backgroundColor: "#ffffff" }}>
        <div className="container mx-auto px-6 max-w-7xl">

          {/* ── MENTOR MARKETPLACE ── */}
          <motion.div
            className="text-center mb-3"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs mb-3" style={{ backgroundColor: "rgba(11,60,93,0.07)", color: "#0B3C5D", border: "1px solid rgba(11,60,93,0.12)", fontWeight: 600 }}>
              <Users size={12} />
              Mentor Marketplace
            </span>
            <h2 className="text-2xl md:text-3xl mb-2 font-medium" style={{ color: "var(--text-primary)" }}>
              Expert guidance, one click away
            </h2>
            <div aria-hidden="true" className="mx-auto" style={{ width: 48, height: 2, borderRadius: 99, backgroundColor: '#0B3C5D', marginTop: 4, marginBottom: 10 }} />
            <p className="text-sm max-w-2xl mx-auto" style={{ color: "var(--text-secondary)", fontFamily: "'Inter', sans-serif", lineHeight: 1.6 }}>
              Connect with verified tutors, counsellors, coaches, and corporate mentors across education and industry. AI-powered recommendations match every learner and professional with the right guide.
            </p>
          </motion.div>

          {/* Mentor Types Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[
              {
                id: "tutors",
                icon: BookOpen,
                title: "Subject Tutors",
                description: "Expert teachers for Mathematics, Science, English and more. Personalized 1-on-1 sessions tailored to your child's pace.",
                stats: "200+ Tutors",
                features: ["Board Exam Prep", "Doubt Clearing", "Concept Building"],
                color: "var(--metryx-blue)"
              },
              {
                id: "counsellors",
                icon: Heart,
                title: "Counsellors",
                description: "Licensed professionals helping students manage exam anxiety, build confidence and develop emotional resilience.",
                stats: "50+ Counsellors",
                features: ["Exam Anxiety", "Career Guidance", "Stress Management"],
                color: "var(--accent-cyan)"
              },
              {
                id: "coaches",
                icon: Target,
                title: "Learning Coaches",
                description: "Strategic coaches who build study habits, time management skills and help students reach peak academic performance.",
                stats: "80+ Coaches",
                features: ["Study Planning", "Time Management", "Goal Setting"],
                color: "var(--metryx-blue)"
              },
              {
                id: "corporate",
                icon: Briefcase,
                title: "Corporate Mentors",
                description: "Senior industry professionals guiding early-career talent through workplace transitions, leadership development, and corporate culture.",
                stats: "60+ Mentors",
                features: ["Leadership Readiness", "Workplace Navigation", "Industry Insights"],
                color: "#0B3C5D"
              },
              {
                id: "career",
                icon: Rocket,
                title: "Career Coaches",
                description: "Placement specialists and career strategists helping students and graduates land their first or next role with confidence.",
                stats: "45+ Coaches",
                features: ["Interview Prep", "Resume Building", "Campus-to-Corporate"],
                color: "#4ECDC4"
              },
              {
                id: "hr-advisors",
                icon: Building2,
                title: "HR & Talent Advisors",
                description: "Certified HR professionals advising organizations on behavioural hiring, competency frameworks, and workforce development strategies.",
                stats: "30+ Advisors",
                features: ["Behavioural Hiring", "Competency Mapping", "L&D Strategy"],
                color: "#0B3C5D"
              }
            ].map((type, idx) => (
              <motion.div
                key={type.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                onClick={() => onNavigate('mentor-marketplace' as Screen)}
                className="p-6 rounded-xl border hover:shadow-lg transition-all group cursor-pointer"
                style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-subtle)" }}
                data-testid={`mentor-type-${type.id}`}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 shrink-0" style={{ backgroundColor: "rgba(11,60,93,0.07)" }}>
                  <type.icon size={22} style={{ color: "#0B3C5D" }} strokeWidth={1.75} />
                </div>
                <h3 className="text-base mb-1 font-medium" style={{ color: "var(--text-primary)" }}>
                  {type.title}
                </h3>
                <p className="text-xs mb-4" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {type.description}
                </p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {type.features.map((f, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-muted)", fontWeight: 500 }}>
                      {f}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                  <span className="text-xs" style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>{type.stats}</span>
                  <span className="text-xs flex items-center gap-1 group-hover:gap-2 transition-all" style={{ color: "var(--text-muted)", fontWeight: 500 }}>
                    Browse <ArrowRight size={12} />
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* How It Works Strip */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-xl border p-4 mb-5"
            style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-subtle)" }}
          >
            <h3 className="text-sm text-center mb-4 font-medium" style={{ color: "var(--text-primary)" }}>
              How it works
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { step: "1", icon: Search, title: "Find", desc: "Browse mentors by subject, type, language and mode" },
                { step: "2", icon: Star, title: "Choose", desc: "Review ratings, experience and verified profiles" },
                { step: "3", icon: Calendar, title: "Book", desc: "Pick a convenient time slot with instant confirmation" },
                { step: "4", icon: Video, title: "Connect", desc: "Join sessions online or meet offline at your convenience" },
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.08 }}
                  className="text-center"
                  data-testid={`mentor-step-${item.step}`}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: "rgba(11,60,93,0.07)" }}>
                    <item.icon size={18} style={{ color: "#0B3C5D" }} />
                  </div>
                  <p className="text-xs mb-0.5" style={{ color: "var(--text-primary)", fontWeight: 600 }}>{item.title}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)", lineHeight: 1.4 }}>{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Trust Features + CTA row */}
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
              {[
                { icon: Shield, label: "Verified Mentors", desc: "Background checked & certified" },
                { icon: Brain, label: "AI Matching", desc: "Smart recommendations based on LBI" },
                { icon: Globe2, label: "Flexible Modes", desc: "Online, offline, or hybrid sessions" },
                { icon: Clock, label: "Easy Scheduling", desc: "Book slots with real-time availability" },
              ].map((feature, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.06 }}
                  className="flex items-start gap-3 p-3 rounded-lg border"
                  style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-subtle)" }}
                  data-testid={`mentor-feature-${idx}`}
                >
                  <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(11,60,93,0.07)" }}>
                    <feature.icon size={16} style={{ color: "#0B3C5D" }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{feature.label}</p>
                    <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{feature.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="shrink-0 text-center md:text-left"
            >
              <button
                onClick={() => onNavigate('mentor-marketplace' as Screen)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm transition-all hover:brightness-105"
                style={{ backgroundColor: "#4ECDC4", color: "#0f172a", fontWeight: 600, fontFamily: "'Inter', sans-serif" }}
                data-testid="btn-explore-mentors"
              >
                Explore Mentor Marketplace
                <ArrowRight size={16} />
              </button>
              <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                330+ verified mentors across 15+ subjects
              </p>
            </motion.div>
          </div>

          {/* ── DIVIDER ── */}
          <div className="relative mb-10" aria-hidden="true">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" style={{ borderColor: "var(--border-subtle)" }} />
            </div>
            <div className="relative flex justify-center">
              <span
                className="px-4 text-xs"
                style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-muted)", fontFamily: "'Inter', sans-serif" }}
              >
                Platform Intelligence Suite
              </span>
            </div>
          </div>

          {/* ── PLATFORM INTELLIGENCE SUITE ── */}
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs mb-4" style={{ backgroundColor: BRAND.primary, color: "#FFFFFF", fontWeight: 600 }}>
              <LayoutDashboard size={14} />
              Platform Intelligence Suite
            </span>
            <h2 className="text-2xl md:text-3xl mb-2 font-medium" style={{ color: "var(--text-primary)" }}>
              A tailored intelligence layer for every stakeholder
            </h2>
            <div aria-hidden="true" className="mx-auto" style={{ width: 48, height: 2, borderRadius: 99, backgroundColor: '#0B3C5D', marginTop: 4, marginBottom: 10 }} />
            <p className="text-sm max-w-2xl mx-auto" style={{ color: "var(--text-secondary)", fontFamily: "'Inter', sans-serif", lineHeight: 1.6 }}>
              From parents and students to institutions and enterprise HR — every role gets a purpose-built intelligence workspace with contextual insights, analytics, and action tools.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
            {[
              {
                id: "parent",
                icon: Users,
                title: "Parent Dashboard",
                label: "Education",
                desc: "Track academic progress, manage LBI insights, create custom tests, and monitor your child's learning journey.",
                screen: "unified-parent-dashboard" as Screen,
                features: ["Child profiles", "Progress tracking", "LBI insights", "Exam management"],
              },
              {
                id: "institute",
                icon: Building2,
                title: "Institute Dashboard",
                label: "Institution",
                desc: "Manage enrollments, create exam templates, run assessments, and access cohort analytics at scale.",
                screen: "unified-institute-dashboard" as Screen,
                features: ["Enrollments", "Exam templates", "Cohort analytics", "Bulk import"],
              },
              {
                id: "student",
                icon: GraduationCap,
                title: "Student Portal",
                label: "Education",
                desc: "Take exams, complete behavioral assessments, view results, and access personalized learning resources.",
                screen: "student-dashboard" as Screen,
                features: ["Exam player", "LBI assessment", "Results", "Learning forum"],
              },
              {
                id: "mentor",
                icon: UserCheck,
                title: "Mentor Dashboard",
                label: "Education",
                desc: "Manage sessions, track earnings, connect with students, and grow your mentoring practice.",
                screen: "mentor-dashboard" as Screen,
                features: ["Session management", "Earnings", "Reviews", "Availability"],
              },
              {
                id: "superadmin",
                icon: Settings,
                title: "Super Admin",
                label: "Platform",
                desc: "Platform-wide KPIs, user management, financial oversight, compliance monitoring, and access control.",
                screen: "super-admin" as Screen,
                features: ["KPI dashboard", "User mgmt", "Financials", "Compliance"],
              },
              {
                id: "hr",
                icon: Briefcase,
                title: "HR & Recruitment",
                label: "Enterprise",
                desc: "Post jobs, manage applicant pipelines, track compliance training, and oversee the hiring workflow.",
                screen: "hr-dashboard" as Screen,
                features: ["Job postings", "Applicant tracking", "Compliance", "Careers portal"],
              },
              {
                id: "ngo",
                icon: Heart,
                title: "NGO Dashboard",
                label: "Social Impact",
                desc: "Manage beneficiary programs, track social impact, and coordinate support for underprivileged children.",
                screen: "ngo-dashboard" as Screen,
                features: ["Beneficiaries", "Impact tracking", "Programs", "Reports"],
              },
              {
                id: "all",
                icon: LayoutDashboard,
                title: "Full Site Map",
                label: "Navigation",
                desc: "Browse every page and screen in MetryxOne — complete navigation across all roles and features.",
                screen: "site-map" as Screen,
                features: ["All pages", "All roles", "All features", "Quick access"],
              },
            ].map((dashboard, idx) => (
              <motion.div
                key={dashboard.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ y: -3, boxShadow: "0 8px 24px rgba(11,60,93,0.10)", transition: { duration: 0.2 } }}
                onClick={() => onNavigate(dashboard.screen)}
                className="relative rounded-xl border transition-all duration-300 group cursor-pointer flex flex-col overflow-hidden"
                style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-subtle)" }}
                data-testid={`dashboard-card-${dashboard.id}`}
              >
                {/* Top bar accent */}
                <div className="h-0.5 w-full" style={{ backgroundColor: BRAND.primary, opacity: 0.12 }} />

                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(78,205,196,0.12)", border: "1px solid rgba(78,205,196,0.30)" }}>
                      <dashboard.icon size={19} style={{ color: BRAND.accent }} />
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(11,60,93,0.07)", color: BRAND.primary, fontWeight: 600, letterSpacing: "0.03em" }}>
                      {dashboard.label}
                    </span>
                  </div>
                  <h3 className="text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
                    {dashboard.title}
                  </h3>
                  <p className="text-xs mb-4 flex-1" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    {dashboard.desc}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 mb-4">
                    {dashboard.features.map((f, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                        <div className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: BRAND.accent }} />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-3 border-t flex items-center justify-between" style={{ borderColor: "var(--border-subtle)" }}>
                    <span className="text-xs font-semibold" style={{ color: BRAND.primary }}>Open →</span>
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: "#4ECDC4" }}>
                      <ArrowRight size={12} style={{ color: "#0f172a" }} />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

        </div>
      </section>
      </LazySection>

      {/* TESTIMONIALS - Horizontal Scroll */}
      <LazySection>
      <section id="testimonials" className="py-14" style={{ backgroundColor: "#ffffff" }}>
        <div className="container relative z-10 mx-auto px-6 max-w-6xl">
          <motion.div
            className="text-center mb-10"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-block px-3 py-1 rounded-full text-xs mb-3 font-semibold" style={{ backgroundColor: "rgba(11,60,93,0.07)", color: "#0B3C5D", border: "1px solid rgba(11,60,93,0.12)" }}>
              Testimonials
            </span>
            <h2 className="text-2xl md:text-3xl font-bold" style={{ color: "#0f172a", letterSpacing: "-0.025em" }}>
              What professionals say
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.slice(0, 3).map((testimonial, idx) => (
              <motion.div
                key={testimonial.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="p-6 rounded-2xl flex flex-col"
                style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
                data-testid={`testimonial-${testimonial.id}`}
              >
                <div className="flex gap-1 mb-4">
                  {[1,2,3,4,5].map(star => (
                    <Star key={star} size={15} fill="#4ECDC4" style={{ color: "#4ECDC4" }} />
                  ))}
                </div>
                <p className="text-sm flex-1 mb-6" style={{ color: "#475569", lineHeight: 1.75 }}>
                  "{testimonial.quote}"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold" style={{ backgroundColor: "#0B3C5D" }}>
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: "#0f172a" }}>{testimonial.author}</div>
                    <div className="text-xs" style={{ color: "#94a3b8" }}>{testimonial.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      </LazySection>

      {/* USE CASES + FAQ SIDE BY SIDE */}
      <LazySection>
      <section id="use-cases-faq" className="py-5" style={{ backgroundColor: "#ffffff" }}>
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* USE CASES - Left Column */}
            <div>
              <motion.div 
                className="mb-6"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <span className="inline-block px-3 py-1 rounded-full text-xs mb-2" style={{ backgroundColor: "rgba(78,205,196,0.1)", color: "#0B3C5D", fontWeight: 600 }}>
                  Use Cases
                </span>
                <h2 className="text-2xl md:text-3xl mb-1 font-medium" style={{ color: "var(--text-primary)" }}>
                  Real problems. Real solutions.
                </h2>
                <p className="text-sm" style={{ color: "var(--text-secondary)", fontFamily: "'Inter', sans-serif" }}>
                  See how MetryxOne transforms challenges into clarity
                </p>
              </motion.div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { id: "parent", icon: Users, title: "Parents", problem: "\"My child works hard but results don't match.\"", solution: "Understand cognitive patterns, not just marks", color: "#1F3C88", navigateTo: "login" as Screen },
                  { id: "student", icon: GraduationCap, title: "Students", problem: "\"I freeze during exams.\"", solution: "Build exam-day confidence", color: "#2EC4B6", navigateTo: "exam-ready" as Screen },
                  { id: "school", icon: Building2, title: "Schools", problem: "\"We need insights without ranking.\"", solution: "Privacy-first cohort analytics", color: "#1F3C88", navigateTo: "k12-schools" as Screen },
                  { id: "coach", icon: Award, title: "Coaching", problem: "\"Who's ready for the exam?\"", solution: "Behavioral readiness signals", color: "#2EC4B6", navigateTo: "coaching" as Screen },
                ].map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => onNavigate(item.navigateTo)}
                    className="p-4 rounded-xl border hover:shadow-md transition-shadow cursor-pointer group"
                    style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-subtle)" }}
                    data-testid={`usecase-${item.id}`}
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: "rgba(11,60,93,0.07)" }}>
                      <item.icon size={18} style={{ color: "#0B3C5D" }} />
                    </div>
                    <h3 className="text-sm mb-1 font-medium" style={{ color: "var(--text-primary)" }}>{item.title}</h3>
                    <p className="text-xs mb-2 italic" style={{ color: "var(--text-muted)" }}>{item.problem}</p>
                    <div className="flex items-center justify-between">
                      <p className="text-xs" style={{ color: "var(--accent-cyan)", fontWeight: 500 }}>{item.solution}</p>
                      <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--accent-cyan)" }} />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* FAQ - Right Column */}
            <div>
              <motion.div 
                className="mb-6"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <span className="inline-block px-3 py-1 rounded-full text-xs mb-2" style={{ backgroundColor: "rgba(11,60,93,0.07)", color: "#0B3C5D", fontWeight: 600 }}>
                  FAQ
                </span>
                <h2 className="text-2xl md:text-3xl mb-1 font-medium" style={{ color: "var(--text-primary)" }}>
                  Common questions
                </h2>
                <p className="text-sm" style={{ color: "var(--text-secondary)", fontFamily: "'Inter', sans-serif" }}>
                  Quick answers to help you get started
                </p>
              </motion.div>

              <div className="space-y-2.5">
                {FAQ_ITEMS.map((faq, idx) => (
                  <motion.details
                    key={faq.id}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.05 }}
                    className="group rounded-lg border overflow-hidden"
                    style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-subtle)" }}
                    data-testid={`faq-${faq.id}`}
                  >
                    <summary className="flex items-center gap-3 p-3.5 cursor-pointer text-left list-none [&::-webkit-details-marker]:hidden">
                      <div 
                        className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                        style={{ backgroundColor: "var(--bg-secondary)" }}
                      >
                        <faq.icon size={16} style={{ color: "var(--accent-cyan)" }} />
                      </div>
                      <span className="flex-1 text-sm" style={{ color: "var(--text-primary)", fontWeight: 500 }}>{faq.q}</span>
                      <ChevronRight size={16} className="group-open:rotate-90 transition-transform" style={{ color: "var(--text-muted)" }} />
                    </summary>
                    <div className="px-3.5 pb-3.5 pl-14">
                      <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>{faq.a}</p>
                    </div>
                  </motion.details>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      </LazySection>

      {/* TRUST & COMPLIANCE - Redesigned */}
      <LazySection>
      <section id="trust" className="py-4 border-t" style={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0" }}>
        <div className="container mx-auto px-6 max-w-5xl">
          <motion.div 
            className="text-center mb-3"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-lg mb-1 font-medium" style={{ color: "var(--text-primary)" }}>
              Trusted by thousands
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Privacy-first, compliant, and secure
            </p>
          </motion.div>

          <div className="flex flex-wrap justify-center items-center gap-4">
            {[
              { id: "dpdp", icon: Lock, label: "DPDP Compliant" },
              { id: "encrypted", icon: ShieldCheck, label: "Data Encrypted" },
              { id: "consent", icon: Users, label: "Parental Consent" },
              { id: "iso", icon: Award, label: "ISO 27001" },
              { id: "child-safe", icon: Heart, label: "Child-Safe" },
            ].map((badge, idx) => (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border"
                style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border-subtle)" }}
                data-testid={`badge-${badge.id}`}
              >
                <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: "rgba(11,60,93,0.07)" }}>
                  <badge.icon size={14} style={{ color: "#0B3C5D" }} />
                </div>
                <span className="text-xs" style={{ color: "var(--text-secondary)", fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>{badge.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      </LazySection>

      {/* PRICING TEASER */}
      <LazySection>
      <section id="pricing" className="py-6" style={{ backgroundColor: "#ffffff" }}>
        <div className="container mx-auto px-6 max-w-5xl">

          {/* Header */}
          <motion.div
            className="text-center mb-3"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs mb-2" style={{ backgroundColor: `${BRAND.accent}18`, color: BRAND.accent, fontWeight: 600 }}>
              <Sparkles size={11} />
              Plans &amp; pricing
            </span>
            <h2 className="text-2xl md:text-3xl mb-2 font-medium" style={{ color: "var(--text-primary)" }}>
              {pricingSegment === 'individual' && 'Everything your child needs to succeed'}
              {pricingSegment === 'institution' && 'Intelligence at scale for schools & institutions'}
              {pricingSegment === 'enterprise' && 'Workforce intelligence for every team size'}
            </h2>
            <div aria-hidden="true" className="mx-auto" style={{ width: 48, height: 2, borderRadius: 99, backgroundColor: '#0B3C5D', marginTop: 6, marginBottom: 10 }} />
            <p className="text-sm max-w-xl mx-auto" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {pricingSegment === 'individual' && 'Choose a platform plan for ongoing tools, then add focused assessments whenever you need deeper insight.'}
              {pricingSegment === 'institution' && 'Cohort-level LBI intelligence, exam management, and parent engagement — built for schools, colleges, and coaching centres.'}
              {pricingSegment === 'enterprise' && 'Behavioural profiling, competency mapping, and compliance intelligence — designed for HR, L&D, and recruitment teams.'}
            </p>
          </motion.div>

          {/* Segment switcher */}
          <motion.div
            className="flex justify-center mb-7"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <div className="inline-flex rounded-xl p-1 gap-1" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-subtle)" }}>
              {([
                { key: 'individual', label: 'Individual', icon: Users },
                { key: 'institution', label: 'Schools & Institutions', icon: Building2 },
                { key: 'enterprise', label: 'Enterprise', icon: Briefcase },
              ] as const).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setPricingSegment(key)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all"
                  style={{
                    backgroundColor: pricingSegment === key ? "#4ECDC4" : 'transparent',
                    color: pricingSegment === key ? '#0f172a' : 'var(--text-secondary)',
                    fontFamily: "'Inter', sans-serif",
                  }}
                  data-testid={`pricing-tab-${key}`}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>
          </motion.div>

          <AnimatePresence mode="wait">

            {/* ── INDIVIDUAL ── */}
            {pricingSegment === 'individual' && (
              <motion.div key="individual" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>

                {/* Platform plans */}
                <div className="mb-7">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>Platform plans</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent, fontWeight: 600 }}>subscription</span>
                  </div>
                  <div className="grid md:grid-cols-3 gap-3">
                    {[
                      { name: 'Free', price: '₹0', period: 'forever', tierKey: 'free', desc: 'Get started instantly', highlights: ['1 child profile', 'Basic progress tracking', 'Exam management'], highlight: false },
                      { name: 'Starter', price: '₹299', period: '/month', tierKey: 'starter', desc: 'For active learners', highlights: ['2 child profiles', 'AI study planner', 'LBI Micro Check'], highlight: false },
                      { name: 'Pro', price: '₹799', period: '/month', tierKey: 'pro', desc: 'Complete learning suite', highlights: ['5 child profiles', 'Full LBI assessments', 'Mentor marketplace'], highlight: true, badge: 'Most popular' },
                    ].map((plan, idx) => (
                      <div
                        key={plan.name}
                        className="relative rounded-xl border flex flex-col overflow-hidden"
                        style={{ backgroundColor: plan.highlight ? BRAND.primary : 'var(--bg-secondary)', borderColor: plan.highlight ? 'transparent' : 'var(--border-subtle)' }}
                        data-testid={`landing-plan-${plan.tierKey}`}
                      >
                        {plan.badge && (
                          <div className="absolute top-0 right-0 px-2.5 py-1 text-[10px] font-medium text-white rounded-bl-xl" style={{ backgroundColor: BRAND.accent }}>
                            {plan.badge}
                          </div>
                        )}
                        <div className="p-5 flex flex-col flex-1">
                          <p className="text-xs mb-0.5" style={{ color: plan.highlight ? 'rgba(255,255,255,0.55)' : 'var(--text-muted)' }}>{plan.desc}</p>
                          <h3 className="text-lg font-medium mb-3" style={{ color: plan.highlight ? '#fff' : 'var(--text-primary)' }}>{plan.name}</h3>
                          <div className="flex items-baseline gap-1 mb-4">
                            <span className="text-2xl font-medium" style={{ color: plan.highlight ? '#fff' : BRAND.primary, fontFamily: "'Inter', sans-serif" }}>{plan.price}</span>
                            <span className="text-xs" style={{ color: plan.highlight ? 'rgba(255,255,255,0.5)' : 'var(--text-muted)' }}>{plan.period}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mb-5 flex-1">
                            {plan.highlights.map((f) => (
                              <span key={f} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: plan.highlight ? 'rgba(255,255,255,0.12)' : `${BRAND.primary}09`, color: plan.highlight ? 'rgba(255,255,255,0.85)' : 'var(--text-secondary)' }}>
                                <div className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: BRAND.accent }} />{f}
                              </span>
                            ))}
                          </div>
                          <button
                            onClick={() => plan.tierKey === 'free' ? handleEntryClick() : onNavigate('pricing')}
                            className="w-full py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                            style={{ backgroundColor: plan.highlight ? '#fff' : 'transparent', color: BRAND.primary, border: plan.highlight ? 'none' : `1.5px solid ${BRAND.primary}`, fontFamily: "'Inter', sans-serif" }}
                            data-testid={`btn-landing-plan-${plan.tierKey}`}
                          >
                            {plan.tierKey === 'free' ? 'Start free' : 'View details'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Assessment add-ons */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>Assessment add-ons</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.primary}10`, color: BRAND.primary, fontWeight: 600 }}>one-time purchase</span>
                  </div>
                  <div className="grid md:grid-cols-3 gap-3">
                    {[
                      { id: "mini-check", name: "Mini Learning Check", price: "₹299", desc: "Quick snapshot of academic and cognitive effectiveness", tags: ["Academic Focus", "Cognitive Speed"], ideal: "Any class", icon: Zap, isPopular: false },
                      { id: "exam-ready", name: "ExamReadiness Index™", price: "₹1,499", desc: "Comprehensive 11-domain assessment for board exam preparation", tags: ["Academic Mastery", "Stress Management", "Time Management", "Confidence", "Focus"], ideal: "Class 9–12", icon: Award, isPopular: true },
                      { id: "stress-check", name: "Stress Check", price: "₹349", desc: "Targeted assessment for examination stress and emotional regulation", tags: ["Exam Anxiety", "Emotional Balance"], ideal: "Any class", icon: Heart, isPopular: false },
                    ].map((pkg, idx) => {
                      const Icon = pkg.icon;
                      return (
                        <div
                          key={pkg.id}
                          className="relative rounded-xl border p-4 flex flex-col"
                          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: pkg.isPopular ? BRAND.accent : 'var(--border-subtle)', boxShadow: pkg.isPopular ? `0 0 0 1.5px ${BRAND.accent}` : 'none' }}
                          data-testid={`featured-pkg-${pkg.id}`}
                        >
                          {pkg.isPopular && (
                            <div className="absolute top-0 right-0 px-2.5 py-1 text-[10px] font-medium text-white rounded-bl-xl" style={{ backgroundColor: BRAND.accent }}>Most popular</div>
                          )}
                          <div className="flex items-center gap-2.5 mb-2">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.primary}09`, border: `1px solid ${BRAND.primary}18` }}>
                              <Icon size={15} style={{ color: BRAND.primary }} />
                            </div>
                            <div>
                              <p className="text-xs font-medium leading-tight" style={{ color: "var(--text-primary)" }}>{pkg.name}</p>
                              <p className="text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>Ideal for: {pkg.ideal}</p>
                            </div>
                          </div>
                          <p className="text-[11px] mb-3 flex-1" style={{ color: "var(--text-secondary)", lineHeight: 1.55 }}>{pkg.desc}</p>
                          <div className="flex flex-wrap gap-1 mb-3">
                            {pkg.tags.map((t, i) => (
                              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.primary}08`, color: "var(--text-muted)" }}>{t}</span>
                            ))}
                          </div>
                          <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                            <div className="flex items-baseline gap-1">
                              <span className="text-base font-medium" style={{ color: "var(--text-primary)", fontFamily: "'Inter', sans-serif" }}>{pkg.price}</span>
                              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>one-time</span>
                            </div>
                            <button onClick={handleEntryClick} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:opacity-90" style={{ backgroundColor: pkg.isPopular ? BRAND.accent : BRAND.primary, color: "#fff" }} data-testid={`btn-get-${pkg.id}`}>
                              Get started
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </motion.div>
            )}

            {/* ── SCHOOLS & INSTITUTIONS ── */}
            {pricingSegment === 'institution' && (
              <motion.div key="institution" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>Institution plans</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent, fontWeight: 600 }}>annual licence</span>
                  </div>
                  <div className="grid md:grid-cols-3 gap-3">
                    {[
                      {
                        tierKey: 'school-starter', name: 'Starter', desc: 'Small schools & coaching centres', price: '₹9,999', period: '/year', badge: null, highlight: false,
                        highlights: ['Up to 100 students', 'Teacher dashboard', 'Exam management', 'Parent reports'],
                        cta: 'Get started',
                      },
                      {
                        tierKey: 'school-growth', name: 'Growth', desc: 'Growing institutions', price: '₹29,999', period: '/year', badge: 'Most popular', highlight: true,
                        highlights: ['Up to 500 students', 'Cohort LBI analytics', 'Bulk import & onboarding', 'AI study planner'],
                        cta: 'Get started',
                      },
                      {
                        tierKey: 'school-enterprise', name: 'Enterprise', desc: 'Large schools & chains', price: 'Custom', period: 'pricing', badge: null, highlight: false,
                        highlights: ['Unlimited students', 'Multi-campus support', 'Custom integrations', 'Dedicated account manager'],
                        cta: 'Talk to us',
                      },
                    ].map((plan) => (
                      <div
                        key={plan.tierKey}
                        className="relative rounded-xl border flex flex-col overflow-hidden"
                        style={{ backgroundColor: plan.highlight ? BRAND.primary : 'var(--bg-secondary)', borderColor: plan.highlight ? 'transparent' : 'var(--border-subtle)' }}
                        data-testid={`landing-plan-${plan.tierKey}`}
                      >
                        {plan.badge && (
                          <div className="absolute top-0 right-0 px-2.5 py-1 text-[10px] font-medium text-white rounded-bl-xl" style={{ backgroundColor: BRAND.accent }}>{plan.badge}</div>
                        )}
                        <div className="p-5 flex flex-col flex-1">
                          <p className="text-xs mb-0.5" style={{ color: plan.highlight ? 'rgba(255,255,255,0.55)' : 'var(--text-muted)' }}>{plan.desc}</p>
                          <h3 className="text-lg font-medium mb-3" style={{ color: plan.highlight ? '#fff' : 'var(--text-primary)' }}>{plan.name}</h3>
                          <div className="flex items-baseline gap-1 mb-4">
                            <span className="text-2xl font-medium" style={{ color: plan.highlight ? '#fff' : BRAND.primary, fontFamily: "'Inter', sans-serif" }}>{plan.price}</span>
                            <span className="text-xs" style={{ color: plan.highlight ? 'rgba(255,255,255,0.5)' : 'var(--text-muted)' }}>{plan.period}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mb-5 flex-1">
                            {plan.highlights.map((f) => (
                              <span key={f} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: plan.highlight ? 'rgba(255,255,255,0.12)' : `${BRAND.primary}09`, color: plan.highlight ? 'rgba(255,255,255,0.85)' : 'var(--text-secondary)' }}>
                                <div className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: BRAND.accent }} />{f}
                              </span>
                            ))}
                          </div>
                          <button
                            onClick={() => onNavigate('pricing')}
                            className="w-full py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                            style={{ backgroundColor: plan.highlight ? '#fff' : 'transparent', color: BRAND.primary, border: plan.highlight ? 'none' : `1.5px solid ${BRAND.primary}`, fontFamily: "'Inter', sans-serif" }}
                            data-testid={`btn-landing-plan-${plan.tierKey}`}
                          >
                            {plan.cta}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Institution assessment bundles */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>Assessment bundles</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.primary}10`, color: BRAND.primary, fontWeight: 600 }}>cohort-level</span>
                  </div>
                  <div className="grid md:grid-cols-3 gap-3">
                    {[
                      { id: "lbi-cohort", name: "LBI Cohort Assessment", desc: "Full 7-dimension behavioural profiling for an entire class or batch", tags: ["Learning styles", "Cognitive mapping", "Educator reports"], icon: Brain },
                      { id: "exam-cohort", name: "ExamReadiness Cohort", desc: "Board exam preparation intelligence across a student cohort with teacher dashboards", tags: ["Batch analytics", "Risk alerts", "Intervention plans"], icon: Award, isHighlight: true },
                      { id: "competency-cohort", name: "Competency Screening", desc: "Map student competencies for placements, internships, and career pathways", tags: ["50 competencies", "Placement readiness", "Gap reports"], icon: Target },
                    ].map((pkg, idx) => {
                      const Icon = pkg.icon;
                      return (
                        <div
                          key={pkg.id}
                          className="relative rounded-xl border p-4 flex flex-col"
                          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: (pkg as any).isHighlight ? BRAND.accent : 'var(--border-subtle)', boxShadow: (pkg as any).isHighlight ? `0 0 0 1.5px ${BRAND.accent}` : 'none' }}
                        >
                          {(pkg as any).isHighlight && (
                            <div className="absolute top-0 right-0 px-2.5 py-1 text-[10px] font-medium text-white rounded-bl-xl" style={{ backgroundColor: BRAND.accent }}>Recommended</div>
                          )}
                          <div className="flex items-center gap-2.5 mb-2">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.primary}09`, border: `1px solid ${BRAND.primary}18` }}>
                              <Icon size={15} style={{ color: BRAND.primary }} />
                            </div>
                            <p className="text-xs font-medium leading-tight" style={{ color: "var(--text-primary)" }}>{pkg.name}</p>
                          </div>
                          <p className="text-[11px] mb-3 flex-1" style={{ color: "var(--text-secondary)", lineHeight: 1.55 }}>{pkg.desc}</p>
                          <div className="flex flex-wrap gap-1 mb-3">
                            {pkg.tags.map((t, i) => <span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.primary}08`, color: "var(--text-muted)" }}>{t}</span>)}
                          </div>
                          <div className="pt-3 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                            <button onClick={() => onNavigate('pricing')} className="text-xs font-semibold transition-all hover:opacity-80" style={{ color: BRAND.primary }}>
                              Request pricing →
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </motion.div>
            )}

            {/* ── ENTERPRISE ── */}
            {pricingSegment === 'enterprise' && (
              <motion.div key="enterprise" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>Workforce plans</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent, fontWeight: 600 }}>per employee / year</span>
                  </div>
                  <div className="grid md:grid-cols-3 gap-3">
                    {[
                      {
                        tierKey: 'ent-team', name: 'Team', desc: 'SMEs & growing businesses', price: '₹499', period: '/employee/yr', badge: null, highlight: false,
                        highlights: ['Up to 50 employees', 'LBI for hiring', 'Competency reports', 'HR dashboard'],
                        cta: 'Get started',
                      },
                      {
                        tierKey: 'ent-business', name: 'Business', desc: 'Mid-size organisations', price: '₹349', period: '/employee/yr', badge: 'Most popular', highlight: true,
                        highlights: ['Up to 250 employees', 'Full competency suite', 'Compliance tracking', 'L&D integration'],
                        cta: 'Get started',
                      },
                      {
                        tierKey: 'ent-enterprise', name: 'Enterprise', desc: 'Large corporations', price: 'Custom', period: 'pricing', badge: null, highlight: false,
                        highlights: ['Unlimited employees', 'HRMS integrations', 'Dedicated CSM', 'SLA & compliance'],
                        cta: 'Contact sales',
                      },
                    ].map((plan) => (
                      <div
                        key={plan.tierKey}
                        className="relative rounded-xl border flex flex-col overflow-hidden"
                        style={{ backgroundColor: plan.highlight ? BRAND.primary : 'var(--bg-secondary)', borderColor: plan.highlight ? 'transparent' : 'var(--border-subtle)' }}
                        data-testid={`landing-plan-${plan.tierKey}`}
                      >
                        {plan.badge && (
                          <div className="absolute top-0 right-0 px-2.5 py-1 text-[10px] font-medium text-white rounded-bl-xl" style={{ backgroundColor: BRAND.accent }}>{plan.badge}</div>
                        )}
                        <div className="p-5 flex flex-col flex-1">
                          <p className="text-xs mb-0.5" style={{ color: plan.highlight ? 'rgba(255,255,255,0.55)' : 'var(--text-muted)' }}>{plan.desc}</p>
                          <h3 className="text-lg font-medium mb-3" style={{ color: plan.highlight ? '#fff' : 'var(--text-primary)' }}>{plan.name}</h3>
                          <div className="flex items-baseline gap-1 mb-4">
                            <span className="text-2xl font-medium" style={{ color: plan.highlight ? '#fff' : BRAND.primary, fontFamily: "'Inter', sans-serif" }}>{plan.price}</span>
                            <span className="text-xs" style={{ color: plan.highlight ? 'rgba(255,255,255,0.5)' : 'var(--text-muted)' }}>{plan.period}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mb-5 flex-1">
                            {plan.highlights.map((f) => (
                              <span key={f} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: plan.highlight ? 'rgba(255,255,255,0.12)' : `${BRAND.primary}09`, color: plan.highlight ? 'rgba(255,255,255,0.85)' : 'var(--text-secondary)' }}>
                                <div className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: BRAND.accent }} />{f}
                              </span>
                            ))}
                          </div>
                          <button
                            onClick={() => onNavigate('pricing')}
                            className="w-full py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                            style={{ backgroundColor: plan.highlight ? '#fff' : 'transparent', color: BRAND.primary, border: plan.highlight ? 'none' : `1.5px solid ${BRAND.primary}`, fontFamily: "'Inter', sans-serif" }}
                            data-testid={`btn-landing-plan-${plan.tierKey}`}
                          >
                            {plan.cta}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Enterprise assessment modules */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>Assessment modules</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.primary}10`, color: BRAND.primary, fontWeight: 600 }}>add-on</span>
                  </div>
                  <div className="grid md:grid-cols-3 gap-3">
                    {[
                      { id: "lbi-hire", name: "LBI for Hiring", desc: "Behavioural pre-screening for candidates across 7 intelligence dimensions", tags: ["Candidate fit", "Culture alignment", "Bias-free scoring"], icon: UserCheck },
                      { id: "competency-map", name: "Competency Intelligence Platform™", desc: "Map 50 workplace competencies across teams, roles, and functions", tags: ["50 competencies", "7 industries", "Team dashboards"], icon: Award, isHighlight: true },
                      { id: "compliance-train", name: "Compliance Training Index", desc: "Track, measure, and report on mandatory compliance training outcomes", tags: ["Completion tracking", "Audit reports", "Risk flags"], icon: Shield },
                    ].map((pkg) => {
                      const Icon = pkg.icon;
                      return (
                        <div
                          key={pkg.id}
                          className="relative rounded-xl border p-4 flex flex-col"
                          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: (pkg as any).isHighlight ? BRAND.accent : 'var(--border-subtle)', boxShadow: (pkg as any).isHighlight ? `0 0 0 1.5px ${BRAND.accent}` : 'none' }}
                        >
                          {(pkg as any).isHighlight && (
                            <div className="absolute top-0 right-0 px-2.5 py-1 text-[10px] font-medium text-white rounded-bl-xl" style={{ backgroundColor: BRAND.accent }}>Flagship</div>
                          )}
                          <div className="flex items-center gap-2.5 mb-2">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.primary}09`, border: `1px solid ${BRAND.primary}18` }}>
                              <Icon size={15} style={{ color: BRAND.primary }} />
                            </div>
                            <p className="text-xs font-medium leading-tight" style={{ color: "var(--text-primary)" }}>{pkg.name}</p>
                          </div>
                          <p className="text-[11px] mb-3 flex-1" style={{ color: "var(--text-secondary)", lineHeight: 1.55 }}>{pkg.desc}</p>
                          <div className="flex flex-wrap gap-1 mb-3">
                            {pkg.tags.map((t, i) => <span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.primary}08`, color: "var(--text-muted)" }}>{t}</span>)}
                          </div>
                          <div className="pt-3 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                            <button onClick={() => onNavigate('pricing')} className="text-xs font-semibold transition-all hover:opacity-80" style={{ color: BRAND.primary }}>
                              Request pricing →
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </motion.div>
            )}

          </AnimatePresence>

          {/* Footer CTA */}
          <motion.div
            className="text-center"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <button
              onClick={() => onNavigate('pricing')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold transition-all hover:opacity-80"
              style={{ color: BRAND.accent, fontFamily: "'Inter', sans-serif" }}
              data-testid="btn-landing-view-all-plans"
            >
              View all plans &amp; compare features <ArrowRight size={13} />
            </button>
            <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>
              {pricingSegment === 'individual' && <>Schools &amp; institutions? <button onClick={() => setPricingSegment('institution')} className="underline hover:opacity-80 transition-opacity" style={{ color: BRAND.primary, fontWeight: 600 }}>See institutional pricing</button></>}
              {pricingSegment === 'institution' && <>Individual plans? <button onClick={() => setPricingSegment('individual')} className="underline hover:opacity-80 transition-opacity" style={{ color: BRAND.primary, fontWeight: 600 }}>View family plans</button></>}
              {pricingSegment === 'enterprise' && <>Need a demo? <button onClick={() => onNavigate('request-demo')} className="underline hover:opacity-80 transition-opacity" style={{ color: BRAND.primary, fontWeight: 600 }}>Request a demo</button></>}
            </p>
          </motion.div>

        </div>
      </section>
      </LazySection>

      {/* FINAL CTA */}
      <LazySection>
      <section className="relative py-16 overflow-hidden" style={{ backgroundColor: "#ffffff", borderTop: "1px solid #e2e8f0" }}>
        <div className="container relative z-10 mx-auto px-6 max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

            {/* LEFT — headline + description + CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6" style={{ backgroundColor: "rgba(11,60,93,0.07)", color: "#0B3C5D", border: "1px solid rgba(11,60,93,0.12)" }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#4ECDC4" }} />
                Join 500+ Organizations on MetryxOne
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold mb-4" style={{ color: "#0f172a", letterSpacing: "-0.025em", lineHeight: 1.15 }}>
                Know where you stand<br />at your level
              </h2>
              <p className="text-base mb-8" style={{ color: "#475569", lineHeight: 1.7 }}>
                Get your behavioral intelligence report in under 40 minutes — includes your stage classification, calibrated gap report, and time-to-next-stage estimate. Free with every MetryxOne account.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <button
                  onClick={() => setShowFreeAssessment(true)}
                  className="px-7 py-3.5 rounded-xl text-sm font-bold transition-all hover:brightness-105 active:scale-95 flex items-center justify-center gap-2"
                  style={{ backgroundColor: "#4ECDC4", color: "#0f172a" }}
                  data-testid="final-cta-primary"
                >
                  Get My Stage Analysis
                  <ArrowRight size={15} />
                </button>
                <button
                  onClick={() => onNavigate('request-demo')}
                  className="px-7 py-3.5 rounded-xl text-sm font-semibold transition-all hover:bg-gray-100 active:scale-95 flex items-center justify-center gap-2"
                  style={{ color: "#0B3C5D", border: "1.5px solid #0B3C5D", backgroundColor: "transparent" }}
                  data-testid="final-cta-secondary"
                >
                  <Calendar size={15} />
                  Request Enterprise Demo
                </button>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs" style={{ color: "#94a3b8" }}>
                <span className="flex items-center gap-1.5"><CheckCircle size={12} style={{ color: "#4ECDC4" }} /> SOC 2 compliant</span>
                <span className="flex items-center gap-1.5"><CheckCircle size={12} style={{ color: "#4ECDC4" }} /> GDPR ready</span>
                <span className="flex items-center gap-1.5"><CheckCircle size={12} style={{ color: "#4ECDC4" }} /> Data never shared</span>
              </div>
            </motion.div>

            {/* RIGHT — 2×2 feature benefit grid */}
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 }}
              className="grid grid-cols-2 gap-4"
            >
              {[
                { icon: Zap,         title: "Instant classification",  desc: "Your stage is detected automatically — no manual form to fill in" },
                { icon: BarChart3,   title: "Fair comparison",         desc: "Always benchmarked against peers at your exact career stage" },
                { icon: Target,      title: "Track your progress",     desc: "Re-assess each quarter and watch your promotion readiness improve" },
                { icon: Lightbulb,   title: "Stage-right learning",    desc: "Recommendations filtered for your level — not one-size content" },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-4 rounded-xl"
                  style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(11,60,93,0.06)" }}>
                    <item.icon size={15} style={{ color: "#0B3C5D" }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-0.5" style={{ color: "#0f172a" }}>{item.title}</p>
                    <p className="text-[11px]" style={{ color: "#64748b", lineHeight: 1.5 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </motion.div>

          </div>
        </div>
      </section>
      </LazySection>

      {/* FOOTER */}
      <Footer onNavigate={onNavigate} />
    </div>
  );
}
