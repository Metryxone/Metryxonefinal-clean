import {
  GraduationCap, CheckCircle, Shield, ArrowRight, ArrowDown,
  BookOpen, Users, Brain, Award, Zap, BarChart3,
  TrendingUp, Sparkles, Layers,
  ClipboardCheck, Target, Heart, UserCheck,
  Briefcase, Building2, Search, ChevronRight, CheckCircle2,
  Star, Play, PieChart, MapPin, Calendar
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Screen } from "../App";

interface Props {
  onNavigate: (screen: Screen) => void;
}

const BRAND = {
  primary: '#344E86',
  accent: '#4ECDC4',
};

const FEATURES = [
  { icon: Brain, title: 'Pre-Placement Behavioral Assessment', desc: 'Comprehensive behavioral profiling across 19 domains and 97 subdomains before candidates enter the hiring pipeline.' },
  { icon: Target, title: 'Campus Hiring Readiness Index', desc: 'Quantified readiness scores measuring adaptability, collaboration, and professional maturity for corporate roles.' },
  { icon: Building2, title: 'University Partnership Management', desc: 'Centralized dashboard to manage multi-university relationships, placement cycles, and assessment schedules.' },
  { icon: BarChart3, title: 'Cohort-Level Analytics', desc: 'Aggregate behavioral intelligence across student cohorts. Compare universities, departments, and graduating classes.' },
  { icon: TrendingUp, title: 'Automated Candidate Ranking', desc: 'AI-powered ranking based on behavioral competency match, culture fit scores, and role-specific potential.' },
  { icon: Sparkles, title: 'Placement Trend Forecasting', desc: 'Predictive analytics on placement outcomes, hiring funnel conversion, and talent pool quality trends.' },
];

const USE_CASES = [
  {
    icon: BookOpen, title: 'Engineering Colleges', color: BRAND.accent,
    items: ['Assess cognitive potential and problem-solving', 'Teamwork and adaptability behavioral scoring', 'Fast-paced engineering role readiness', 'Scale to 1000+ candidates per drive'],
  },
  {
    icon: Briefcase, title: 'Business Schools', color: BRAND.primary,
    items: ['Leadership potential and strategic thinking', 'Interpersonal skills and EQ assessment', 'Culture alignment with corporate values', 'MBA-specific competency benchmarks'],
  },
  {
    icon: Users, title: 'Multi-Campus Drives', color: '#8b5cf6',
    items: ['Standardized assessments across universities', 'Consistent candidate ranking algorithms', 'Cross-campus talent pool comparison', 'Streamlined bulk hiring workflows'],
  },
];

const HOW_IT_WORKS = [
  { step: 1, title: 'Partner with Campus', desc: 'Establish university partnerships, configure assessment parameters, and define role-specific competency profiles.', icon: ClipboardCheck },
  { step: 2, title: 'Assess Students', desc: 'Deploy AI-adaptive assessments to entire cohorts. Automated scheduling, proctoring, and real-time tracking.', icon: Brain },
  { step: 3, title: 'Match & Hire', desc: 'Review AI-generated rankings, behavioral reports, and culture-fit scores. Make data-driven hiring decisions.', icon: UserCheck },
];

const TESTIMONIALS = [
  { quote: 'MetryxOne transformed our campus recruitment. We assessed 800+ students across 5 universities in just 3 days and identified our strongest hires yet.', name: 'Rajesh Kumar', role: 'Campus Hiring Lead, Infosys', avatar: 'RK' },
  { quote: 'The culture-fit scoring is a game-changer. We reduced first-year attrition by 28% by matching graduates to the right teams from day one.', name: 'Meera Joshi', role: 'Head of Talent, Wipro HR', avatar: 'MJ' },
];

const IMPACT_STATS = [
  { value: '800+', label: 'Students per drive', icon: Users },
  { value: '28%', label: 'Lower first-year attrition', icon: TrendingUp },
  { value: '3x', label: 'Faster shortlisting', icon: Zap },
  { value: '50+', label: 'Partner universities', icon: GraduationCap },
];

export function CampusRecruitPage({ onNavigate }: Props) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Navbar onNavigate={onNavigate} currentScreen="campus-recruit" />

      <main className="flex-1 pt-20">
        <section className="relative py-14 md:py-20 px-4 overflow-hidden" style={{ backgroundColor: BRAND.primary }} data-testid="campus-hero-section">
          <div className="absolute inset-0 opacity-[0.05]">
            <div className="absolute top-12 left-[8%] w-48 h-48 rounded-full border border-white" />
            <div className="absolute bottom-12 right-[6%] w-72 h-72 rounded-full border border-white" />
            <div className="absolute top-[30%] right-[25%] w-32 h-32 rounded-full border border-white" />
          </div>

          <div className="max-w-6xl mx-auto relative">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="text-white">
                <div className="flex items-center gap-2 mb-5">
                  <Badge className="bg-white/15 text-white border-0 text-xs px-3 py-1.5 font-medium" data-testid="badge-campus-solution">
                    <GraduationCap size={12} className="mr-1" /> Solution
                  </Badge>
                  <Badge className="border-0 text-xs px-3 py-1.5 font-semibold" style={{ backgroundColor: `${BRAND.accent}30`, color: BRAND.accent }} data-testid="badge-campus-enterprise">
                    CAMPUS
                  </Badge>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold mb-3 leading-tight tracking-tight" data-testid="text-campus-title">
                  Campus Recruitment
                </h1>
                <p className="text-base font-medium mb-2 text-white/90 leading-relaxed" data-testid="text-campus-subtitle">
                  University-to-Workforce Talent Signals & Matching
                </p>
                <p className="text-sm text-white/65 mb-6 leading-relaxed max-w-md" data-testid="text-campus-desc">
                  Transform campus hiring with behavioral intelligence. Identify high-potential
                  graduates across 19 behavioral domains, predict job-readiness, and match
                  talent to roles with data-driven precision.
                </p>
                <div className="flex flex-col sm:flex-row gap-2.5 mb-6">
                  <Button
                    className="text-white font-medium h-10 px-6 text-sm rounded-lg"
                    style={{ backgroundColor: BRAND.accent }}
                    onClick={() => onNavigate('request-demo')}
                    data-testid="btn-campus-get-started"
                  >
                    Get Started <ArrowRight size={15} className="ml-1.5" />
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/25 text-white hover:bg-white/10 h-10 px-6 text-sm font-medium rounded-lg"
                    onClick={() => onNavigate('lbi-product')}
                    data-testid="btn-campus-learn-more"
                  >
                    Learn About LBI
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-xs text-white/70 font-medium" data-testid="campus-trust-badges">
                  <span className="flex items-center gap-1.5" data-testid="trust-university">
                    <CheckCircle size={13} style={{ color: BRAND.accent }} /> University Partnerships
                  </span>
                  <span className="flex items-center gap-1.5" data-testid="trust-bias-free">
                    <Shield size={13} style={{ color: BRAND.accent }} /> Bias-Free
                  </span>
                  <span className="flex items-center gap-1.5" data-testid="trust-dpdp">
                    <CheckCircle size={13} style={{ color: BRAND.accent }} /> DPDP Compliant
                  </span>
                  <span className="flex items-center gap-1.5" data-testid="trust-analytics">
                    <Zap size={13} style={{ color: BRAND.accent }} /> Real-Time Analytics
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: GraduationCap, value: '50+', label: 'Universities', sub: 'partner campuses' },
                    { icon: Layers, value: '19', label: 'Behavioral Domains', sub: 'comprehensive coverage' },
                  ].map((stat, idx) => (
                    <Card key={idx} className="bg-white/10 border-0" data-testid={`campus-stat-card-${idx}`}>
                      <CardContent className="p-4 text-center text-white">
                        <stat.icon size={22} className="mx-auto mb-2" style={{ color: BRAND.accent }} />
                        <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                        <p className="text-xs font-semibold text-white/85 mt-0.5">{stat.label}</p>
                        <p className="text-[10px] text-white/45 mt-0.5">{stat.sub}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Brain, value: '97', label: 'Competency Signals', sub: 'granular profiling' },
                    { icon: Sparkles, value: 'AI', label: 'Smart Matching', sub: 'intelligent pairing' },
                  ].map((stat, idx) => (
                    <Card key={idx + 2} className="bg-white/10 border-0" data-testid={`campus-stat-card-${idx + 2}`}>
                      <CardContent className="p-4 text-center text-white">
                        <stat.icon size={22} className="mx-auto mb-2" style={{ color: BRAND.accent }} />
                        <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                        <p className="text-xs font-semibold text-white/85 mt-0.5">{stat.label}</p>
                        <p className="text-[10px] text-white/45 mt-0.5">{stat.sub}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Card className="bg-white/10 border-0" data-testid="campus-compliance-card">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 text-white">
                      <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.accent}25` }}>
                        <Award size={20} style={{ color: BRAND.accent }} />
                      </div>
                      <div>
                        <p className="text-xs font-bold">Bias-Free & DPDP Compliant</p>
                        <p className="text-[10px] text-white/55">AI-powered campus assessments validated for fairness and privacy</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="flex justify-center mt-8">
              <div className="animate-bounce">
                <ArrowDown size={18} className="text-white/30" />
              </div>
            </div>
          </div>
        </section>

        <section className="py-10 px-4" data-testid="campus-impact-strip">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {IMPACT_STATS.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: `${BRAND.primary}04` }} data-testid={`campus-impact-${i}`}>
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.accent}12` }}>
                    <item.icon size={18} style={{ color: BRAND.accent }} />
                  </div>
                  <div>
                    <p className="text-lg font-bold" style={{ color: BRAND.primary }}>{item.value}</p>
                    <p className="text-[11px] leading-tight" style={{ color: 'var(--text-secondary)' }}>{item.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-14 px-4" style={{ backgroundColor: 'var(--bg-secondary)' }} data-testid="campus-features-section">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-5 gap-10 items-start">
              <div className="lg:col-span-2">
                <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.accent}20`, color: BRAND.accent }} data-testid="badge-campus-features">
                  Platform Features
                </Badge>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-3" style={{ color: BRAND.primary }} data-testid="text-campus-features-title">
                  Campus Hiring, Reimagined
                </h2>
                <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }} data-testid="text-campus-features-desc">
                  End-to-end behavioral intelligence tools built for modern campus recruitment — from
                  engineering colleges to business schools.
                </p>
                <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
                  Designed for scale. Assess thousands of candidates across multiple campuses
                  with consistent, bias-free behavioral profiling.
                </p>
                <Button
                  className="font-medium px-6 h-9 rounded-lg text-white text-sm"
                  style={{ backgroundColor: BRAND.accent }}
                  onClick={() => onNavigate('request-demo')}
                  data-testid="btn-campus-features-demo"
                >
                  <Play size={14} className="mr-1.5" /> See It in Action
                </Button>
              </div>
              <div className="lg:col-span-3 grid sm:grid-cols-2 gap-4" data-testid="campus-features-grid">
                {FEATURES.map((feature, idx) => (
                  <Card key={idx} className="border-0 shadow-sm hover:shadow-md transition-all group" data-testid={`campus-feature-card-${idx}`}>
                    <CardContent className="p-5">
                      <div
                        className="h-10 w-10 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-105"
                        style={{ backgroundColor: `${idx % 2 === 0 ? BRAND.primary : BRAND.accent}10` }}
                      >
                        <feature.icon size={20} style={{ color: idx % 2 === 0 ? BRAND.primary : BRAND.accent }} />
                      </div>
                      <p className="text-sm font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>{feature.title}</p>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{feature.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-14 px-4" data-testid="campus-dashboard-preview-section">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-8">
              <div>
                <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }} data-testid="badge-campus-preview">
                  Campus Dashboard
                </Badge>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }} data-testid="text-campus-preview-title">
                  Your Recruitment Command Center
                </h2>
                <p className="mt-1.5 text-sm max-w-xl" style={{ color: 'var(--text-secondary)' }} data-testid="text-campus-preview-desc">
                  Multi-campus analytics, candidate rankings, and placement readiness — all in one view
                </p>
              </div>
              <Button
                variant="outline"
                className="font-medium px-5 h-9 rounded-lg shrink-0 text-sm"
                style={{ borderColor: BRAND.primary, color: BRAND.primary }}
                onClick={() => onNavigate('request-demo')}
                data-testid="btn-campus-preview-demo"
              >
                <Play size={13} className="mr-1.5" /> Request Live Demo
              </Button>
            </div>

            <div className="grid lg:grid-cols-5 gap-5">
              <div className="lg:col-span-3">
                <Card className="border-0 shadow-md h-full overflow-hidden" data-testid="campus-dashboard-mockup">
                  <div className="px-4 py-2.5 flex items-center justify-between border-b" style={{ backgroundColor: BRAND.primary }}>
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}30` }}>
                        <GraduationCap size={14} style={{ color: BRAND.accent }} />
                      </div>
                      <div className="text-white">
                        <p className="text-xs font-bold">Campus Drive Dashboard</p>
                        <p className="text-[9px] text-white/55">Spring 2026 · 5 Universities · 843 candidates</p>
                      </div>
                    </div>
                    <Badge className="bg-white/15 text-white border-0 text-[9px] px-2 py-0.5" data-testid="badge-campus-dash-live">Active</Badge>
                  </div>
                  <CardContent className="p-4 space-y-4" style={{ backgroundColor: '#fafbfc' }}>
                    <div>
                      <p className="text-[10px] font-bold mb-2 uppercase tracking-wider" style={{ color: BRAND.primary }}>University Performance</p>
                      <div className="space-y-2">
                        {[
                          { uni: 'IIT Delhi', candidates: 186, avgScore: 78, topPct: 32 },
                          { uni: 'BITS Pilani', candidates: 142, avgScore: 74, topPct: 28 },
                          { uni: 'NIT Trichy', candidates: 198, avgScore: 71, topPct: 24 },
                          { uni: 'VIT Vellore', candidates: 167, avgScore: 69, topPct: 21 },
                          { uni: 'IIIT Hyderabad', candidates: 150, avgScore: 76, topPct: 30 },
                        ].map((u, i) => (
                          <div key={i} className="flex items-center gap-3 p-2 rounded-lg border" data-testid={`campus-uni-${i}`}>
                            <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.primary}08` }}>
                              <Building2 size={13} style={{ color: BRAND.primary }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{u.uni}</p>
                              <p className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>{u.candidates} candidates</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold" style={{ color: BRAND.primary }}>{u.avgScore}</p>
                              <p className="text-[9px]" style={{ color: BRAND.accent }}>Top {u.topPct}%</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold mb-2 uppercase tracking-wider" style={{ color: BRAND.primary }}>Drive Pipeline</p>
                      <div className="grid grid-cols-5 gap-1.5">
                        {[
                          { stage: 'Registered', count: 843 },
                          { stage: 'Assessed', count: 712 },
                          { stage: 'Shortlisted', count: 186 },
                          { stage: 'Interviewed', count: 92 },
                          { stage: 'Offered', count: 34 },
                        ].map((s, i) => (
                          <div key={i} className="text-center p-2 rounded-lg border" data-testid={`campus-pipeline-${i}`}>
                            <p className="text-sm font-bold" style={{ color: BRAND.primary }}>{s.count}</p>
                            <p className="text-[8px] font-medium" style={{ color: 'var(--text-secondary)' }}>{s.stage}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 p-2.5 rounded-lg border" style={{ borderColor: `${BRAND.accent}25` }} data-testid="campus-dash-insight">
                      <Sparkles size={14} style={{ color: BRAND.accent }} />
                      <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                        <span className="font-semibold" style={{ color: BRAND.primary }}>AI Insight:</span> IIT Delhi and IIIT Hyderabad cohorts show 18% higher adaptability scores — recommend priority shortlisting for product roles.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-2 space-y-4">
                <Card className="border-0 shadow-md" data-testid="campus-upcoming-drives">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}12` }}>
                        <Calendar size={16} style={{ color: BRAND.accent }} />
                      </div>
                      <h3 className="font-bold text-sm" style={{ color: BRAND.primary }}>Upcoming Drives</h3>
                    </div>
                    <div className="space-y-2">
                      {[
                        { uni: 'IIT Bombay', date: 'Mar 15', students: 220 },
                        { uni: 'NSIT Delhi', date: 'Mar 22', students: 180 },
                        { uni: 'IIM Bangalore', date: 'Apr 03', students: 95 },
                        { uni: 'DTU Delhi', date: 'Apr 10', students: 310 },
                      ].map((drive, idx) => (
                        <div key={idx} className="flex items-center gap-2.5 p-2.5 rounded-lg border hover:shadow-sm transition-all cursor-pointer group" data-testid={`campus-drive-${idx}`}>
                          <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.primary}06` }}>
                            <GraduationCap size={14} style={{ color: BRAND.primary }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{drive.uni}</p>
                            <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{drive.date} · {drive.students} students</p>
                          </div>
                          <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: BRAND.accent }} />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-md" data-testid="campus-readiness-overview">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}08` }}>
                        <PieChart size={16} style={{ color: BRAND.primary }} />
                      </div>
                      <h3 className="font-bold text-sm" style={{ color: BRAND.primary }}>Readiness Overview</h3>
                    </div>
                    <div className="space-y-2.5">
                      {[
                        { label: 'Cognitive Readiness', pct: 74 },
                        { label: 'Collaboration Score', pct: 81 },
                        { label: 'Professional Maturity', pct: 68 },
                        { label: 'Adaptability Index', pct: 77 },
                      ].map((item, idx) => (
                        <div key={idx} data-testid={`campus-readiness-${idx}`}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{item.label}</span>
                            <span className="font-bold" style={{ color: item.pct >= 75 ? BRAND.accent : BRAND.primary }}>{item.pct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full" style={{ backgroundColor: `${BRAND.accent}12` }}>
                            <div className="h-full rounded-full" style={{ width: `${item.pct}%`, backgroundColor: item.pct >= 75 ? BRAND.accent : BRAND.primary }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section className="py-14 px-4" style={{ backgroundColor: 'var(--bg-secondary)' }} data-testid="campus-use-cases-section">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }} data-testid="badge-campus-use-cases">
                Campus Scenarios
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }} data-testid="text-campus-use-cases-title">
                Built for Every Campus Scenario
              </h2>
              <p className="mt-2 text-sm max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }} data-testid="text-campus-use-cases-desc">
                Tailored assessment solutions for engineering, management, and multi-campus drives
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {USE_CASES.map((uc, idx) => (
                <Card key={idx} className="border-0 shadow-sm hover:shadow-md transition-all overflow-hidden group" data-testid={`campus-use-case-${idx}`}>
                  <div className="h-1.5" style={{ backgroundColor: uc.color }} />
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2.5 mb-4">
                      <div
                        className="h-11 w-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
                        style={{ backgroundColor: `${uc.color}10` }}
                      >
                        <uc.icon size={22} style={{ color: uc.color }} />
                      </div>
                      <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{uc.title}</h3>
                    </div>
                    <div className="space-y-2">
                      {uc.items.map((item) => (
                        <div key={item} className="flex items-start gap-2">
                          <CheckCircle2 size={13} className="shrink-0 mt-0.5" style={{ color: uc.color }} />
                          <span className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{item}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-14 px-4" data-testid="campus-testimonials-section">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }} data-testid="badge-campus-testimonials">
                Recruiters Say
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }} data-testid="text-campus-testimonials-title">
                Trusted by Leading Campus Recruiters
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
              {TESTIMONIALS.map((t, idx) => (
                <Card key={idx} className="border-0 shadow-sm hover:shadow-md transition-all" data-testid={`campus-testimonial-${idx}`}>
                  <CardContent className="p-5">
                    <div className="flex gap-0.5 mb-3">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} size={13} fill={BRAND.accent} style={{ color: BRAND.accent }} />
                      ))}
                    </div>
                    <p className="text-xs leading-relaxed mb-5 italic" style={{ color: 'var(--text-secondary)' }}>
                      "{t.quote}"
                    </p>
                    <div className="flex items-center gap-2.5 pt-3 border-t" style={{ borderColor: `${BRAND.primary}08` }}>
                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                        style={{ backgroundColor: BRAND.primary }}
                      >
                        {t.avatar}
                      </div>
                      <div>
                        <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{t.name}</p>
                        <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{t.role}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-14 px-4" style={{ backgroundColor: 'var(--bg-secondary)' }} data-testid="campus-how-it-works-section">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }} data-testid="badge-campus-how">
                Simple Process
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }} data-testid="text-campus-how-title">
                Get Started in 3 Steps
              </h2>
              <p className="mt-2 text-sm max-w-lg mx-auto" style={{ color: 'var(--text-secondary)' }} data-testid="text-campus-how-desc">
                From campus partnership to confident hiring decisions
              </p>
            </div>

            <div className="relative">
              <div className="hidden md:block absolute top-14 left-[16%] right-[16%] h-px" style={{ backgroundColor: `${BRAND.accent}20` }} />
              <div className="grid md:grid-cols-3 gap-6">
                {HOW_IT_WORKS.map((step) => (
                  <div key={step.step} className="relative text-center" data-testid={`campus-step-${step.step}`}>
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-sm relative z-10"
                      style={{ backgroundColor: BRAND.primary }}
                    >
                      {step.step}
                    </div>
                    <Card className="border-0 shadow-sm hover:shadow-md transition-all group">
                      <CardContent className="p-6 text-center">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3 transition-transform group-hover:scale-105"
                          style={{ backgroundColor: `${BRAND.accent}10` }}
                        >
                          <step.icon size={20} style={{ color: BRAND.accent }} />
                        </div>
                        <h4 className="text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{step.title}</h4>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{step.desc}</p>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 px-4" style={{ backgroundColor: BRAND.primary }} data-testid="campus-cta-section">
          <div className="max-w-3xl mx-auto text-center">
            <div className="h-12 w-12 rounded-xl bg-white/12 flex items-center justify-center mx-auto mb-5">
              <GraduationCap size={24} className="text-white" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 tracking-tight" data-testid="text-campus-cta">
              Transform Your <span style={{ color: BRAND.accent }}>Campus Hiring</span>
            </h2>
            <p className="text-white/65 text-sm mb-8 max-w-lg mx-auto leading-relaxed" data-testid="text-campus-cta-desc">
              Join forward-thinking enterprises using MetryxOne to discover top campus talent
              through behavioral intelligence and AI-powered matching.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 mb-6">
              <Button
                className="h-10 px-8 font-medium text-sm rounded-lg text-white"
                style={{ backgroundColor: BRAND.accent }}
                onClick={() => onNavigate('request-demo')}
                data-testid="btn-campus-cta-demo"
              >
                Request a Demo <ArrowRight size={15} className="ml-1.5" />
              </Button>
              <Button
                variant="outline"
                className="h-10 px-8 font-medium text-sm border-white/25 text-white hover:bg-white/10 rounded-lg"
                onClick={() => onNavigate('support')}
                data-testid="btn-campus-cta-contact"
              >
                Contact Sales
              </Button>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-white/50 text-xs" data-testid="campus-cta-trust">
              <span className="flex items-center gap-1.5" data-testid="cta-trust-unis"><GraduationCap size={13} /> 50+ partner universities</span>
              <span className="flex items-center gap-1.5" data-testid="cta-trust-bias"><Shield size={13} /> Bias-free assessments</span>
              <span className="flex items-center gap-1.5" data-testid="cta-trust-free"><CheckCircle size={13} /> Free pilot program</span>
            </div>
          </div>
        </section>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
