import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, CheckCircle, ChevronDown, ChevronRight, Clock, Shield, ArrowRight,
  Target, BookOpen, Users, Lightbulb, Zap, BarChart3, Lock, GraduationCap,
  TrendingUp, Sparkles, Eye, Heart, Activity, MessageSquare, Compass,
  AlertTriangle, Cpu, School, Star, HelpCircle, Puzzle, RefreshCw, Workflow,
  ShieldCheck, Gauge, GitBranch, ScanSearch, Play, Layers, Quote, Award,
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Screen } from "../App";

interface Props { onNavigate: (screen: Screen) => void; }

const B = { blue: '#344E86', teal: '#4ECDC4' };

/* ─── DATA ───────────────────────────────────────────────────────────── */
const DOMAINS = [
  { id: 'D01', name: 'Academic & cognitive effectiveness',        subdomains: 6,  icon: Brain,         desc: 'Learning efficiency, conceptual understanding, memory, sustained attention, learning style, and processing stability' },
  { id: 'D02', name: 'Thinking quality under pressure',           subdomains: 8,  icon: Target,        desc: 'Analytical thinking, decision quality, complexity management, exam strategy, error handling, and situational judgment' },
  { id: 'D03', name: 'Examination stress & emotional regulation', subdomains: 9,  icon: Activity,      desc: 'Stress reactivity, emotional regulation, cognitive control, recovery speed, anticipatory management, and strategy flexibility' },
  { id: 'D04', name: 'Confidence, self-concept & comparison',     subdomains: 9,  icon: Star,          desc: 'Academic self-confidence, stability, self-concept clarity, social comparison, fear of evaluation, and attribution style' },
  { id: 'D05', name: 'Adjustment & coping capacity',              subdomains: 4,  icon: RefreshCw,     desc: 'Academic, emotional, social, and family adjustment patterns' },
  { id: 'D06', name: 'Social & emotional intelligence',           subdomains: 4,  icon: Heart,         desc: 'Emotional regulation, relationships, trust, and sense of inclusion' },
  { id: 'D07', name: 'Discipline, habits & consistency',          subdomains: 5,  icon: Clock,         desc: 'Time management, accountability, execution discipline, plan alignment, and consistency' },
  { id: 'D08', name: 'Communication & expression',                subdomains: 5,  icon: MessageSquare, desc: 'Listening, expression, influence, conflict handling, and instruction comprehension' },
  { id: 'D09', name: 'Motivation, values & responsibility',       subdomains: 5,  icon: Zap,           desc: 'Drive, commitment stability, integrity, ownership patterns, and effort persistence' },
  { id: 'D10', name: 'Lifestyle & pressure environment',          subdomains: 4,  icon: Eye,           desc: 'Digital distraction, sleep quality, parental pressure, and institutional pressure' },
  { id: 'D11', name: 'Competitive exam readiness',                subdomains: 5,  icon: Gauge,         desc: 'Performance stability, pressure tolerance, consistency, variance analysis, and recovery speed' },
  { id: 'D12', name: 'Integrated root cause mapping',             subdomains: 4,  icon: GitBranch,     desc: 'Cross-domain synthesis, module clustering, temporal weighting, and expert confirmation' },
  { id: 'D13', name: 'Academic planning & recovery',              subdomains: 6,  icon: Compass,       desc: 'Planning realism, prioritization, recovery capacity, strategy correction, and short-term recovery windows' },
  { id: 'D14', name: 'Metacognition & self-regulation',           subdomains: 3,  icon: ScanSearch,    desc: 'Error awareness, strategy switching, and self-correction timing' },
  { id: 'D15', name: 'Help-seeking & support utilization',        subdomains: 4,  icon: HelpCircle,    desc: 'Help-seeking hesitation, trust in authority, response to guidance, and silent failure prevention' },
  { id: 'D16', name: 'Academic identity & meaning',               subdomains: 4,  icon: Puzzle,        desc: 'Subject relevance perception, sense of agency, identity alignment, and engagement risk' },
  { id: 'D17', name: 'Transition & change adaptability',          subdomains: 6,  icon: Workflow,      desc: 'Flexibility, uncertainty tolerance, adaptation speed, instability, disengagement, and recovery delay' },
  { id: 'D18', name: 'Teacher-student interaction',               subdomains: 3,  icon: School,        desc: 'Instruction responsiveness, feedback sensitivity, and authority interaction comfort' },
  { id: 'D19', name: 'Over-compliance risk',                      subdomains: 3,  icon: AlertTriangle, desc: 'Excessive compliance, fear-driven obedience, and suppressed autonomy' },
];

const AGE_BANDS = [
  { code: 'A', range: '6–10 yrs',  label: 'Primary',          icon: BookOpen,      desc: 'Foundational learning patterns, basic cognitive habits, early behavioural indicators, and initial social-emotional development.' },
  { code: 'B', range: '11–14 yrs', label: 'Middle school',    icon: GraduationCap, desc: 'Developing critical thinking, emerging exam stress patterns, peer comparison sensitivity, and academic identity formation.' },
  { code: 'C', range: '15–18 yrs', label: 'Senior secondary', icon: Target,        desc: 'Advanced cognitive load, competitive exam readiness, career alignment, metacognitive maturity, and complex stress management.' },
];

const HOW_IT_WORKS = [
  { step: 1, title: 'Consent & registration', desc: 'Parent provides DPDP-compliant consent. Student profile created with age-appropriate assessment.',    icon: ShieldCheck },
  { step: 2, title: 'Adaptive assessment',    desc: 'Age-band specific questions across 19 domains. AI adapts difficulty. Takes 45–60 min.',              icon: Brain       },
  { step: 3, title: 'AI analysis engine',     desc: 'Proprietary scoring algorithms. Cross-domain correlation analysis identifies root causes.',           icon: Cpu         },
  { step: 4, title: 'Comprehensive report',   desc: 'Domain scores, subdomain breakdowns, trend analysis, and personalised action plans.',                icon: BarChart3   },
];

const STAKEHOLDER_BENEFITS = [
  { role: 'Parents',             icon: Users,         benefits: ['Understand why effort isn\'t matching results', 'Get personalised action plans for each child', 'Track behavioural progress over time', 'Identify hidden stress and pressure patterns'] },
  { role: 'Schools & institutes', icon: School,        benefits: ['Cohort-level behavioural intelligence dashboards', 'Early identification of at-risk students', 'Evidence-based intervention recommendations', 'NEP 2020 and DPDP compliant reporting'] },
  { role: 'Students',             icon: GraduationCap, benefits: ['Understand your own learning patterns', 'Build self-awareness and metacognitive skills', 'Get strategies tailored to your thinking style', 'Reduce exam anxiety with targeted techniques'] },
];

const WHY_LBI = [
  { icon: Brain,      title: 'Behavioural, not academic',  desc: 'Measures how students think and learn.' },
  { icon: GitBranch,  title: 'AI root cause mapping',      desc: 'Cross-domain AI finds true root causes.' },
  { icon: Shield,     title: 'Privacy-first',              desc: 'DPDP compliant, SOC2 certified.' },
  { icon: TrendingUp, title: 'Longitudinal tracking',      desc: 'Track growth across assessment cycles.' },
  { icon: Layers,     title: '97 subdomains',              desc: 'Each domain has actionable subdomains.' },
  { icon: Cpu,        title: 'Adaptive engine',            desc: 'Questions adapt to age band and responses.' },
  { icon: Award,      title: 'Research validated',         desc: 'Built on established psychometric science.' },
  { icon: RefreshCw,  title: 'Recovery planning',          desc: '30–60 day action windows built in.' },
];

const TESTIMONIALS = [
  { quote: 'Finally, a platform that doesn\'t label my child but helps us understand how she thinks and learns. The insights were eye-opening.', author: 'Priya Sharma',    role: 'Parent of class 10 student',     avatar: 'PS' },
  { quote: 'MetryxOne helped our school identify learning patterns across cohorts without individual ranking. Policy-aligned and privacy-first.', author: 'Dr. Rajesh Kumar', role: 'Principal, DPS Noida',           avatar: 'RK' },
  { quote: 'The LBI assessment helped me understand why I freeze during exams. Now I have strategies that actually work.',                        author: 'Arjun Mehta',       role: 'Class 12 student, JEE aspirant', avatar: 'AM' },
];

const FAQS = [
  { icon: Brain,         q: 'What is Learning Behavior Index (LBI)?',          a: 'LBI is a comprehensive psychometric assessment framework that measures learning behaviours across 19 scientifically validated domains and 97 subdomains. Unlike traditional IQ or academic tests, LBI focuses on how a student thinks, learns, and performs — not just what they know.' },
  { icon: Layers,        q: 'How many domains does LBI assess?',               a: 'LBI covers 19 domains ranging from Academic & Cognitive Effectiveness to Over-Compliance Risk, with 97 subdomains in total. Each domain provides granular insight into specific behavioural patterns that affect learning outcomes.' },
  { icon: GraduationCap, q: 'What are the age bands and why do they matter?',  a: 'LBI uses three age bands: A (6–10 years), B (11–14 years), and C (15–18 years). Questions, scoring norms, and interpretations are calibrated for each age band to ensure developmental appropriateness and accuracy.' },
  { icon: Clock,         q: 'How long does the assessment take?',              a: 'A full LBI assessment takes approximately 45–60 minutes. The system adapts question flow based on responses, so some students may finish sooner. Partial completion is saved and can be resumed.' },
  { icon: Shield,        q: 'Is LBI compliant with data privacy regulations?', a: 'Yes. LBI is fully compliant with India\'s DPDP Act, GDPR, and follows SOC2 Type II standards. All assessments require explicit parental consent for minors, and data is encrypted at rest and in transit.' },
];

/* ─── SCORECARD DATA ─────────────────────────────────────────────────── */
const SCORE_BARS = [
  { code: 'D01', label: 'Academic effectiveness',        score: 78 },
  { code: 'D03', label: 'Stress & emotional regulation', score: 52 },
  { code: 'D04', label: 'Confidence & self-concept',     score: 65 },
  { code: 'D07', label: 'Discipline & habits',           score: 85 },
  { code: 'D11', label: 'Exam readiness',                score: 71 },
  { code: 'D15', label: 'Help-seeking behaviour',        score: 41 },
];

/* ─── ANIMATION ──────────────────────────────────────────────────────── */
const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number,number,number,number] },
} as const;

/* ─── PANEL HEADER (blue bar) ────────────────────────────────────────── */
function PanelHeader({ icon: Icon, label, sublabel }: { icon: React.ElementType; label: string; sublabel: string }) {
  return (
    <div className="px-4 py-2.5 flex items-center gap-2 border-b" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
      <div className="w-7 h-7 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(78,205,196,0.12)', border: '1px solid rgba(78,205,196,0.25)' }}>
        <Icon size={14} style={{ color: B.teal }} />
      </div>
      <span className="text-sm font-semibold" style={{ color: B.blue }}>{label}</span>
      <span className="text-sm ml-1" style={{ color: '#6b7280' }}>{sublabel}</span>
    </div>
  );
}

/* ─── COMPACT SECTION LABEL ──────────────────────────────────────────── */
function SLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block px-2.5 py-0.5 rounded text-xs font-medium text-white mb-1" style={{ backgroundColor: B.blue }}>
      {children}
    </span>
  );
}

/* ─── PAGE ───────────────────────────────────────────────────────────── */
export function LBIProductPage({ onNavigate }: Props) {
  const [expandedFaq, setExpandedFaq]       = useState<number | null>(null);
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [testimonialIdx, setTestimonialIdx] = useState(0);

  const domainCategories = [
    { key: 'all',          label: 'All 19' },
    { key: 'cognitive',    label: 'Cognitive',    ids: ['D01', 'D02', 'D14'] },
    { key: 'emotional',    label: 'Emotional',    ids: ['D03', 'D04', 'D06'] },
    { key: 'behavioral',   label: 'Behavioural',  ids: ['D05', 'D07', 'D08', 'D09'] },
    { key: 'environmental',label: 'Environmental',ids: ['D10', 'D18', 'D19'] },
    { key: 'advanced',     label: 'Advanced',     ids: ['D11', 'D12', 'D13', 'D15', 'D16', 'D17'] },
  ];

  const filteredDomains = activeCategory === 'all'
    ? DOMAINS
    : DOMAINS.filter(d => domainCategories.find(c => c.key === activeCategory)?.ids?.includes(d.id));

  const totalSubdomains = DOMAINS.reduce((sum, d) => sum + d.subdomains, 0);
  const avgScore = Math.round(SCORE_BARS.reduce((s, b) => s + b.score, 0) / SCORE_BARS.length);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <Navbar onNavigate={onNavigate} currentScreen="lbi-product" />

      <main className="flex-1 pt-16">

        {/* ══ HERO ══ */}
        <section className="relative py-8 overflow-hidden border-b" style={{ borderColor: 'var(--border-subtle)' }} data-testid="lbi-hero-section">
          {/* dot grid only — no gradient orbs */}
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
            style={{
              backgroundImage: 'transparent',
              backgroundSize: '26px 26px',
            }}
          />
          <div className="max-w-6xl mx-auto px-4 relative z-10">
            <div className="grid lg:grid-cols-2 gap-8 items-center">

              {/* left */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: B.teal }}>
                    <Brain size={12} /> Core assessment
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>50,000+</strong> students profiled
                  </span>
                </div>

                <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-2" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }} data-testid="text-lbi-title">
                  Learning Behavior <span style={{ color: B.teal }}>Index</span>
                  <span className="font-light text-2xl ml-1" style={{ color: 'var(--text-muted)' }}>™</span>
                </h1>

                {/* solid accent bar — no gradient */}
                <div className="mb-3" style={{ width: 40, height: 3, borderRadius: 99, backgroundColor: B.blue }} />

                <p className="text-base mb-4 max-w-md leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Comprehensive behavioural intelligence assessment for students aged 6–18. Goes beyond grades to reveal cognitive patterns, emotional responses, and learning behaviours.
                </p>

                <div className="flex flex-wrap gap-2 mb-4">
                  <Button className="font-medium h-9 px-6 text-sm rounded-lg text-white" style={{ backgroundColor: B.blue }} onClick={() => onNavigate('request-demo')} data-testid="btn-lbi-get-started">
                    Get started <ArrowRight size={14} className="ml-1" />
                  </Button>
                  <Button variant="outline" className="h-9 px-6 text-sm font-medium rounded-lg" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} onClick={() => onNavigate('exam-ready')} data-testid="btn-lbi-compare">
                    Compare packages
                  </Button>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {[{ icon: CheckCircle, t: 'Age-adaptive (6–18 yrs)' }, { icon: Shield, t: 'DPDP compliant' }, { icon: Cpu, t: 'AI-powered' }, { icon: Lock, t: 'SOC2 certified' }].map((x, i) => (
                    <span key={i} className="flex items-center gap-1"><x.icon size={11} style={{ color: B.teal }} />{x.t}</span>
                  ))}
                </div>
              </div>

              {/* right — stats panel */}
              <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'rgba(52,78,134,0.15)' }}>
                <PanelHeader icon={Brain} label="LBI™" sublabel="Learning Behavior Index" />
                <div className="px-4 py-1.5 flex flex-wrap gap-3 border-b" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}>
                  {['19 domains', `${totalSubdomains} subdomains`, '3 age bands', '500+ questions'].map((s, i) => (
                    <span key={i} className="text-sm" style={{ color: 'var(--text-muted)' }}>{s}</span>
                  ))}
                </div>
                <div className="grid grid-cols-2 divide-x divide-y" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                  {[
                    { value: '19',   label: 'Domains',   sub: `${totalSubdomains} subdomains` },
                    { value: '50K+', label: 'Students',  sub: 'profiled across India' },
                    { value: '500+', label: 'Questions', sub: 'per age band' },
                    { value: '3',    label: 'Age bands', sub: '6–10, 11–14, 15–18' },
                  ].map((stat, idx) => (
                    <div key={idx} className="px-4 py-3 text-center" data-testid={`stat-card-${idx}`}>
                      <p className="text-2xl font-bold" style={{ color: B.blue }}>{stat.value}</p>
                      <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{stat.label}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{stat.sub}</p>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-1.5 flex justify-between" style={{ borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-primary)' }}>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Scores illustrative</span>
                  <span className="text-xs" style={{ color: B.teal }}>50K+ profiled</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ VALUE STRIP ══ */}
        <section style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }} data-testid="lbi-value-strip">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4" style={{ borderColor: 'var(--border-subtle)' }}>
              {[
                { icon: Brain,      label: 'Behavioural focus', text: 'Measures how students think, not what they know' },
                { icon: Sparkles,   label: 'AI-powered',        text: 'Root cause analysis across all 19 domains' },
                { icon: TrendingUp, label: 'Track growth',      text: 'Longitudinal tracking across assessment cycles' },
                { icon: Shield,     label: 'Privacy-first',     text: 'DPDP, GDPR, SOC2 compliant' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 px-4 py-3 border-r last:border-r-0" style={{ borderColor: 'var(--border-subtle)' }} data-testid={`value-item-${i}`}>
                  <div className="w-8 h-8 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: `${B.blue}0d` }}>
                    <item.icon size={15} style={{ color: B.blue }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.label}</p>
                    <p className="text-xs leading-snug" style={{ color: 'var(--text-muted)' }}>{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ DOMAINS ══ */}
        <section className="py-5 px-4" style={{ backgroundColor: 'var(--bg-primary)' }} data-testid="lbi-domains-section">
          <div className="max-w-6xl mx-auto">
            {/* header row */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
              <div>
                <SLabel>Comprehensive framework</SLabel>
                <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }} data-testid="text-domains-title">
                  19 domains · {totalSubdomains} subdomains
                </h2>
              </div>
              <div className="flex flex-wrap gap-1" data-testid="domain-category-filter">
                {domainCategories.map(cat => (
                  <button key={cat.key} onClick={() => setActiveCategory(cat.key)}
                    className="px-3 py-1 rounded text-xs font-medium transition-all"
                    style={{
                      backgroundColor: activeCategory === cat.key ? B.blue : 'transparent',
                      color: activeCategory === cat.key ? '#fff' : 'var(--text-secondary)',
                      border: `1px solid ${activeCategory === cat.key ? B.blue : 'var(--border-subtle)'}`,
                    }}
                    data-testid={`filter-${cat.key}`}
                  >
                    {cat.label}
                    {cat.key !== 'all' && (cat as any).ids && <span className="ml-0.5 opacity-50">({(cat as any).ids.length})</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
              {filteredDomains.map((domain, di) => {
                const isExpanded = expandedDomain === domain.id;
                const accent = di % 2 === 0 ? B.blue : B.teal;
                return (
                  <div key={domain.id}
                    className="rounded-lg border cursor-pointer transition-colors"
                    style={{ borderColor: isExpanded ? accent : 'var(--border-subtle)', backgroundColor: isExpanded ? `${accent}05` : 'var(--bg-secondary)' }}
                    onClick={() => setExpandedDomain(isExpanded ? null : domain.id)}
                    data-testid={`domain-card-${domain.id}`}
                  >
                    <div className="p-2.5">
                      <div className="flex items-start gap-1.5">
                        <div className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: `${accent}10` }}>
                          <domain.icon size={11} style={{ color: accent }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 mb-0.5">
                            <span className="text-[11px] font-medium px-1 rounded" style={{ backgroundColor: `${accent}12`, color: accent }}>{domain.id}</span>
                            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{domain.subdomains}s</span>
                          </div>
                          <h3 className="text-xs font-medium leading-tight" style={{ color: 'var(--text-primary)' }}>{domain.name}</h3>
                        </div>
                        <ChevronDown size={11} className="shrink-0 mt-0.5" style={{ color: 'var(--border-subtle)', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                      </div>
                      {isExpanded && (
                        <div className="mt-1.5 pt-1.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{domain.desc}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Scores are age-band calibrated and norm-referenced.</p>
          </div>
        </section>

        {/* ══ HOW IT WORKS + AGE BANDS (side by side) ══ */}
        <section className="py-5 px-4" style={{ backgroundColor: 'var(--bg-secondary)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }} data-testid="lbi-process-section">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-5">

              {/* How it works */}
              <div>
                <SLabel>Assessment process</SLabel>
                <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }} data-testid="text-how-it-works-title">How LBI works</h2>
                <div className="space-y-2">
                  {HOW_IT_WORKS.map((step, idx) => (
                    <div key={step.step} className="flex items-start gap-3 p-3 rounded-lg border" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }} data-testid={`step-${step.step}`}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0" style={{ backgroundColor: B.blue }}>
                        {step.step}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{step.title}</p>
                        <p className="text-xs leading-snug mt-0.5" style={{ color: 'var(--text-secondary)' }}>{step.desc}</p>
                      </div>
                      <div className="w-7 h-7 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: `${B.teal}12` }}>
                        <step.icon size={14} style={{ color: B.teal }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Age bands */}
              <div>
                <SLabel>Age-adaptive assessment</SLabel>
                <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }} data-testid="text-age-bands-title">Calibrated for every stage</h2>
                <div className="space-y-2">
                  {AGE_BANDS.map((band, bi) => {
                    const accent = bi === 0 ? B.teal : B.blue;
                    return (
                      <div key={band.code} className="flex items-start gap-3 p-3 rounded-lg border overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', borderLeft: `3px solid ${accent}` }} data-testid={`age-band-${band.code}`}>
                        <div className="w-8 h-8 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: `${accent}10` }}>
                          <band.icon size={15} style={{ color: accent }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }} data-testid={`text-age-range-${band.code}`}>{band.range}</span>
                            <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: `${accent}12`, color: accent }}>{band.label}</span>
                          </div>
                          <p className="text-xs leading-snug" style={{ color: 'var(--text-secondary)' }} data-testid={`text-age-desc-${band.code}`}>{band.desc}</p>
                        </div>
                        <span className="text-xs shrink-0 font-medium" style={{ color: accent }}>Band {band.code}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ REPORT + INSIGHTS (side by side) ══ */}
        <section className="py-5 px-4" style={{ backgroundColor: 'var(--bg-primary)' }} data-testid="lbi-report-section">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <SLabel>Sample report</SLabel>
                <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }} data-testid="text-report-preview-title">What your report reveals</h2>
              </div>
              <Button variant="outline" className="font-medium px-4 rounded-lg h-8 text-sm" style={{ borderColor: B.blue, color: B.blue }} onClick={() => onNavigate('request-demo')} data-testid="btn-view-sample">
                <Play size={12} className="mr-1" /> Request sample
              </Button>
            </div>

            <div className="grid lg:grid-cols-5 gap-4">
              {/* vertical bar chart */}
              <div className="lg:col-span-3 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border-subtle)' }}>
                <PanelHeader icon={BarChart3} label="Domain-level scorecard" sublabel="Percentile scores" />
                <div className="p-4" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  {(() => {
                    const maxH = 120;
                    return (
                      <>
                        <div className="flex items-end gap-2">
                          {/* Y-axis */}
                          <div className="flex flex-col justify-between pr-1 shrink-0 pb-6" style={{ height: maxH + 2 }}>
                            {[100, 50, 0].map(v => (
                              <span key={v} className="block text-right leading-none" style={{ color: 'rgba(52,78,134,0.45)', fontSize: 11 }}>{v}</span>
                            ))}
                          </div>
                          {/* bars */}
                          <div className="flex-1 flex flex-col">
                            <div className="relative" style={{ height: maxH }}>
                              <div className="absolute inset-x-0 top-0"   style={{ borderTop: '1px dashed rgba(52,78,134,0.07)' }} />
                              <div className="absolute inset-x-0 top-1/2" style={{ borderTop: '1px dashed rgba(52,78,134,0.07)' }} />
                              <div className="absolute inset-x-0 bottom-0" style={{ borderTop: '1.5px solid rgba(52,78,134,0.13)' }} />
                              <div className="absolute bottom-0 inset-x-0 flex items-end gap-1">
                                {SCORE_BARS.map((bar, bi) => {
                                  const barH = Math.round((bar.score / 100) * (maxH - 2));
                                  const color = bi % 2 === 0 ? B.blue : B.teal;
                                  return (
                                    <div key={bar.code} className="flex-1 flex flex-col items-center justify-end" data-testid={`report-score-row-${bi}`}>
                                      <span className="leading-none mb-0.5 tabular-nums" style={{ color, fontSize: 11, fontWeight: 600 }} data-testid={`text-score-value-${bi}`}>{bar.score}</span>
                                      <motion.div className="w-full rounded-t-sm" style={{ backgroundColor: color, minHeight: 2 }}
                                        initial={{ height: 0 }} whileInView={{ height: barH }} viewport={{ once: true }}
                                        transition={{ duration: 0.5, delay: bi * 0.06, ease: 'easeOut' }}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="flex gap-1 mt-1">
                              {SCORE_BARS.map((bar, bi) => (
                                <div key={bar.code} className="flex-1 text-center">
                                  <span className="block leading-none font-medium" style={{ color: bi % 2 === 0 ? B.blue : B.teal, fontSize: 11 }} data-testid={`text-score-domain-${bi}`}>{bar.code}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 pt-2 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>Sample data. Actual reports include all 19 domains.</p>
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Avg <span className="font-medium" style={{ color: B.teal }}>{avgScore}</span>/100</span>
                        </div>

                        {/* domain legend */}
                        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                          {SCORE_BARS.map((bar, bi) => {
                            const color = bi % 2 === 0 ? B.blue : B.teal;
                            return (
                              <div key={bar.code} className="flex items-center gap-2">
                                <span className="text-[11px] font-semibold shrink-0 w-8 tabular-nums" style={{ color }}>{bar.code}</span>
                                <div className="flex-1 relative h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${color}18` }}>
                                  <motion.div className="absolute inset-y-0 left-0 rounded-full" style={{ backgroundColor: color }}
                                    initial={{ width: 0 }} whileInView={{ width: `${bar.score}%` }} viewport={{ once: true }}
                                    transition={{ duration: 0.5, delay: bi * 0.05 + 0.3, ease: 'easeOut' }}
                                  />
                                </div>
                                <span className="text-[11px] font-medium shrink-0 tabular-nums w-6 text-right" style={{ color }}>{bar.score}</span>
                                <span className="text-[11px] shrink-0 hidden sm:block" style={{ color: 'var(--text-muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bar.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* insights */}
              <div className="lg:col-span-2 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border-subtle)' }}>
                <PanelHeader icon={Lightbulb} label="Key insights" sublabel="AI analysis" />
                <div className="p-4 space-y-2" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  {[
                    { label: 'Root cause',  text: 'Help-seeking hesitation (D15) suppressing recovery capacity (D13), creating silent struggle.',  border: B.blue },
                    { label: 'Strength',    text: 'Strong execution discipline (D07) with high consistency indicates reliable study habits.',        border: B.teal },
                    { label: 'Action plan', text: 'Structured check-ins to normalise help-seeking. 30-day recovery window.',                        border: B.blue },
                    { label: 'Trend alert', text: 'Stress reactivity (D03) increased 12% since last assessment.',                                  border: B.teal },
                  ].map((insight, idx) => (
                    <div key={idx} className="p-3 rounded-lg border-l-2" style={{ backgroundColor: `${insight.border}05`, borderLeftColor: insight.border }} data-testid={`insight-card-${idx}`}>
                      <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: insight.border }}>{insight.label}</p>
                      <p className="text-sm leading-snug" style={{ color: 'var(--text-secondary)' }}>{insight.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ WHY LBI + STAKEHOLDERS (side by side) ══ */}
        <section className="py-5 px-4" style={{ backgroundColor: 'var(--bg-secondary)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }} data-testid="lbi-why-stakeholders-section">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-6">

              {/* Why LBI */}
              <div>
                <SLabel>Why choose LBI</SLabel>
                <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Not just another test</h2>
                <div className="grid grid-cols-2 gap-2" data-testid="lbi-why-section">
                  {WHY_LBI.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 p-3 rounded-lg border" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}>
                      <div className="w-7 h-7 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: idx % 2 === 0 ? `${B.blue}0d` : `${B.teal}12` }}>
                        <item.icon size={13} style={{ color: idx % 2 === 0 ? B.blue : B.teal }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-tight" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
                        <p className="text-xs leading-snug mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stakeholders */}
              <div>
                <SLabel>For every stakeholder</SLabel>
                <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Actionable intelligence for everyone</h2>
                <div className="space-y-2" data-testid="lbi-stakeholders-section">
                  {STAKEHOLDER_BENEFITS.map((s, idx) => (
                    <div key={idx} className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                      <div className="px-3 py-2 flex items-center gap-2" style={{ backgroundColor: B.blue }}>
                        <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: 'rgba(78,205,196,0.2)' }}>
                          <s.icon size={13} style={{ color: B.teal }} />
                        </div>
                        <span className="text-sm font-medium text-white">{s.role}</span>
                      </div>
                      <div className="p-3 grid grid-cols-2 gap-x-4 gap-y-1.5" style={{ backgroundColor: 'var(--bg-primary)' }}>
                        {s.benefits.map((b, bi) => (
                          <div key={bi} className="flex items-start gap-1.5">
                            <CheckCircle size={12} className="shrink-0 mt-0.5" style={{ color: B.teal }} />
                            <span className="text-xs leading-snug" style={{ color: 'var(--text-secondary)' }}>{b}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ TESTIMONIALS + FAQ (side by side) ══ */}
        <section className="py-5 px-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-6">

              {/* Testimonials */}
              <div>
                <SLabel>Testimonials</SLabel>
                <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>What parents & educators say</h2>
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                  <AnimatePresence mode="wait">
                    <motion.div key={testimonialIdx} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="p-4" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                      <Quote size={18} className="mb-2" style={{ color: B.teal }} />
                      <p className="text-sm leading-relaxed mb-3 italic" style={{ color: 'var(--text-primary)' }}>"{TESTIMONIALS[testimonialIdx].quote}"</p>
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold" style={{ backgroundColor: B.blue }}>{TESTIMONIALS[testimonialIdx].avatar}</div>
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{TESTIMONIALS[testimonialIdx].author}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{TESTIMONIALS[testimonialIdx].role}</p>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
                <div className="flex gap-1.5 mt-2">
                  {TESTIMONIALS.map((_, idx) => (
                    <button key={idx} onClick={() => setTestimonialIdx(idx)} className="w-2 h-2 rounded-full transition-all" style={{ backgroundColor: idx === testimonialIdx ? B.teal : 'var(--border-subtle)', transform: idx === testimonialIdx ? 'scale(1.2)' : 'none' }} />
                  ))}
                </div>
              </div>

              {/* FAQ */}
              <div>
                <SLabel>FAQ</SLabel>
                <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Frequently asked questions</h2>
                <div className="space-y-1.5" data-testid="lbi-faq-section">
                  {FAQS.map((faq, idx) => (
                    <div key={idx} className="rounded-lg border overflow-hidden transition-colors"
                      style={{ borderColor: expandedFaq === idx ? B.teal : 'var(--border-subtle)', backgroundColor: 'var(--bg-secondary)' }}
                      data-testid={`faq-item-${idx}`}
                    >
                      <button className="w-full flex items-center gap-2 p-3 text-left" onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)} data-testid={`faq-toggle-${idx}`}>
                        <div className="w-7 h-7 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: expandedFaq === idx ? B.teal : `${B.teal}12` }}>
                          <faq.icon size={13} style={{ color: expandedFaq === idx ? '#fff' : B.teal }} />
                        </div>
                        <span className="flex-1 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{faq.q}</span>
                        <ChevronRight size={14} style={{ color: 'var(--text-muted)', transform: expandedFaq === idx ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                      </button>
                      {expandedFaq === idx && (
                        <div className="px-3 pb-3 pl-12">
                          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{faq.a}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ CTA (compact solid) ══ */}
        <section className="py-6 px-4" style={{ backgroundColor: B.blue }}>
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white mb-1">Ready to unlock your child's learning potential?</h2>
              <p className="text-base" style={{ color: 'rgba(255,255,255,0.6)' }}>Join 50,000+ students already assessed across India</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button className="font-medium h-9 px-6 text-sm rounded-lg text-white" style={{ backgroundColor: B.teal }} onClick={() => onNavigate('request-demo')} data-testid="btn-lbi-cta-start">
                Start free assessment <ArrowRight size={14} className="ml-1" />
              </Button>
              <Button variant="outline" className="h-9 px-6 text-sm font-medium rounded-lg" style={{ borderColor: 'rgba(255,255,255,0.25)', color: '#fff', backgroundColor: 'transparent' }} onClick={() => onNavigate('contact')} data-testid="btn-lbi-cta-contact">
                Talk to an expert
              </Button>
            </div>
          </div>
        </section>

      </main>
      <Footer onNavigate={onNavigate} />
    </div>
  );
}
