import {
  Target, CheckCircle, Shield, ArrowRight, ArrowDown,
  BookOpen, Users, Brain, Award, Zap, BarChart3, Lock,
  GraduationCap, TrendingUp, Sparkles, Heart, Layers,
  ClipboardCheck, AlertTriangle, Activity, Clock,
  MessageSquare, Eye, Play, ChevronRight, CheckCircle2, Star
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
  { icon: Brain, title: 'Exam Psychological Readiness', desc: 'Measure cognitive readiness, pressure tolerance, and mental preparedness for competitive exams like JEE, NEET, and UPSC.' },
  { icon: Heart, title: 'Stress Management Profiling', desc: 'Identify stress triggers, anxiety patterns, and emotional regulation capacity specific to high-stakes exam environments.' },
  { icon: BookOpen, title: 'Study Habit Analysis', desc: 'Deep-dive into study discipline, time management, consistency patterns, and learning strategy effectiveness.' },
  { icon: TrendingUp, title: 'Performance Prediction Engine', desc: 'AI-powered forecasting of exam outcomes based on behavioral patterns, stress levels, and readiness indicators.' },
  { icon: BarChart3, title: 'Batch-Level Analytics', desc: 'Cohort-wide dashboards to compare batch performance, identify at-risk students, and optimize teaching interventions.' },
  { icon: MessageSquare, title: 'Parent Communication Tools', desc: 'Automated parent updates with student progress, readiness scores, and personalized recommendations for home support.' },
];

const USE_CASES = [
  {
    icon: Sparkles, title: 'JEE Coaching', color: BRAND.accent,
    items: ['Psychological readiness for JEE Main & Advanced', 'Track stress patterns during intensive prep', 'Predict performance variance across subjects', 'Identify students at risk of burnout early'],
  },
  {
    icon: Activity, title: 'NEET Coaching', color: BRAND.primary,
    items: ['Evaluate exam anxiety and confidence volatility', 'Study habit consistency monitoring', 'Biology vs chemistry stress differential', 'Early intervention for underperformers'],
  },
  {
    icon: Award, title: 'UPSC Preparation', color: '#8b5cf6',
    items: ['Long-duration preparation readiness', 'Motivation sustainability tracking', 'Disciplinary consistency scoring', 'Multi-year preparation cycle support'],
  },
];

const HOW_IT_WORKS = [
  { step: 1, title: 'Register Institute', desc: 'Create your institute profile, configure batches and exam categories, set up faculty access and enrollment workflows.', icon: ClipboardCheck },
  { step: 2, title: 'Run LBI Assessments', desc: 'Deploy targeted ExamReadiness assessments across batches. AI-adaptive questions calibrated for competitive exam context.', icon: Brain },
  { step: 3, title: 'Optimize Readiness', desc: 'Access real-time dashboards with batch analytics, individual readiness scores, stress alerts, and intervention strategies.', icon: Target },
];

const TESTIMONIALS = [
  { quote: 'We saw a 22% improvement in student confidence scores after just one semester of using MetryxOne\'s ExamReadiness assessments.', name: 'Vikram Agarwal', role: 'Director, Resonance JEE Academy', avatar: 'VA' },
  { quote: 'The stress mapping feature helped us identify 15 students at burnout risk — we intervened before it affected their NEET scores.', name: 'Dr. Priya Nair', role: 'Head of Coaching, Allen Career', avatar: 'PN' },
];

export function CoachingPage({ onNavigate }: Props) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Navbar onNavigate={onNavigate} currentScreen="coaching" />

      <main className="flex-1 pt-20">
        <section className="relative py-14 md:py-20 px-4 overflow-hidden" style={{ backgroundColor: BRAND.primary }} data-testid="coaching-hero-section">
          <div className="absolute inset-0 opacity-[0.05]">
            <div className="absolute top-12 left-[8%] w-48 h-48 rounded-full border border-white" />
            <div className="absolute bottom-12 right-[6%] w-72 h-72 rounded-full border border-white" />
            <div className="absolute top-[30%] right-[25%] w-32 h-32 rounded-full border border-white" />
          </div>

          <div className="max-w-6xl mx-auto relative">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="text-white">
                <div className="flex items-center gap-2 mb-5">
                  <Badge className="bg-white/15 text-white border-0 text-xs px-3 py-1.5 font-medium" data-testid="badge-coaching-solution">
                    <Target size={12} className="mr-1" /> Solution
                  </Badge>
                  <Badge className="border-0 text-xs px-3 py-1.5 font-semibold" style={{ backgroundColor: `${BRAND.accent}30`, color: BRAND.accent }} data-testid="badge-coaching-popular">
                    POPULAR
                  </Badge>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold mb-3 leading-tight tracking-tight" data-testid="text-coaching-title">
                  Coaching Institutes
                </h1>
                <p className="text-base font-medium mb-2 text-white/90 leading-relaxed" data-testid="text-coaching-subtitle">
                  JEE / NEET / UPSC Exam Readiness Optimization
                </p>
                <p className="text-sm text-white/65 mb-6 leading-relaxed max-w-md" data-testid="text-coaching-desc">
                  Go beyond academic coaching. Understand the psychological readiness, stress patterns,
                  and behavioral factors that determine exam success. Help every student perform at their true potential.
                </p>
                <div className="flex flex-col sm:flex-row gap-2.5 mb-6">
                  <Button
                    className="text-white font-medium h-10 px-6 text-sm rounded-lg"
                    style={{ backgroundColor: BRAND.accent }}
                    onClick={() => onNavigate('request-demo')}
                    data-testid="btn-coaching-get-started"
                  >
                    Get Started <ArrowRight size={15} className="ml-1.5" />
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/25 text-white hover:bg-white/10 h-10 px-6 text-sm font-medium rounded-lg"
                    onClick={() => onNavigate('exam-ready')}
                    data-testid="btn-coaching-exam-ready"
                  >
                    Explore ExamReady™
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-xs text-white/70 font-medium" data-testid="coaching-trust-badges">
                  <span className="flex items-center gap-1.5" data-testid="trust-jee">
                    <CheckCircle size={13} style={{ color: BRAND.accent }} /> JEE Ready
                  </span>
                  <span className="flex items-center gap-1.5" data-testid="trust-neet">
                    <CheckCircle size={13} style={{ color: BRAND.accent }} /> NEET Ready
                  </span>
                  <span className="flex items-center gap-1.5" data-testid="trust-upsc">
                    <CheckCircle size={13} style={{ color: BRAND.accent }} /> UPSC Ready
                  </span>
                  <span className="flex items-center gap-1.5" data-testid="trust-boards">
                    <CheckCircle size={13} style={{ color: BRAND.accent }} /> Board Exams
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Users, value: '10K+', label: 'Students Assessed', sub: 'across institutes' },
                    { icon: Layers, value: '19', label: 'LBI Domains', sub: 'comprehensive coverage' },
                  ].map((stat, idx) => (
                    <Card key={idx} className="bg-white/10 border-0" data-testid={`coaching-stat-card-${idx}`}>
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
                    { icon: Sparkles, value: 'ExamReadiness™', label: 'Proprietary Index', sub: 'AI-powered scoring' },
                    { icon: Zap, value: '<2s', label: 'AI Response', sub: 'real-time insights' },
                  ].map((stat, idx) => (
                    <Card key={idx + 2} className="bg-white/10 border-0" data-testid={`coaching-stat-card-${idx + 2}`}>
                      <CardContent className="p-4 text-center text-white">
                        <stat.icon size={22} className="mx-auto mb-2" style={{ color: BRAND.accent }} />
                        <p className="text-lg font-bold tracking-tight">{stat.value}</p>
                        <p className="text-xs font-semibold text-white/85 mt-0.5">{stat.label}</p>
                        <p className="text-[10px] text-white/45 mt-0.5">{stat.sub}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Card className="bg-white/10 border-0" data-testid="coaching-readiness-card">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 text-white">
                      <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.accent}25` }}>
                        <Award size={20} style={{ color: BRAND.accent }} />
                      </div>
                      <div>
                        <p className="text-xs font-bold">ExamReadiness Index™ Certified</p>
                        <p className="text-[10px] text-white/55">Proprietary readiness scoring for competitive exams</p>
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

        <section className="py-10 px-4" data-testid="coaching-value-strip">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Sparkles, label: 'ExamReadiness Index™', text: 'Proprietary scoring system measuring psychological exam preparedness' },
                { icon: Heart, label: 'Stress & Anxiety Mapping', text: 'Identify and address stress triggers before they impact performance' },
                { icon: TrendingUp, label: 'Performance Prediction', text: 'AI-powered forecasting of exam outcomes and risk indicators' },
                { icon: AlertTriangle, label: 'Dropout Risk Alert', text: 'Early warning system for students at risk of dropping out' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: `${BRAND.primary}04` }} data-testid={`coaching-value-item-${i}`}>
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.accent}12` }}>
                    <item.icon size={16} style={{ color: BRAND.accent }} />
                  </div>
                  <div>
                    <p className="text-xs font-bold mb-0.5" style={{ color: BRAND.primary }}>{item.label}</p>
                    <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-14 px-4" style={{ backgroundColor: 'var(--bg-secondary)' }} data-testid="coaching-features-section">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-5 gap-10 items-start">
              <div className="lg:col-span-2">
                <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.accent}20`, color: BRAND.accent }} data-testid="badge-coaching-features">
                  Platform Features
                </Badge>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-3" style={{ color: BRAND.primary }} data-testid="text-coaching-features-title">
                  Built for Competitive Exam Coaching
                </h2>
                <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }} data-testid="text-coaching-features-desc">
                  Comprehensive tools to understand, predict, and optimize student exam readiness
                  across JEE, NEET, UPSC, and board exam preparation.
                </p>
                <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
                  Every feature is designed for coaching environments — high-pressure, high-stakes,
                  and time-sensitive preparation contexts.
                </p>
                <Button
                  className="font-medium px-6 h-9 rounded-lg text-white text-sm"
                  style={{ backgroundColor: BRAND.accent }}
                  onClick={() => onNavigate('request-demo')}
                  data-testid="btn-coaching-features-demo"
                >
                  <Play size={14} className="mr-1.5" /> See It in Action
                </Button>
              </div>
              <div className="lg:col-span-3 grid sm:grid-cols-2 gap-4" data-testid="coaching-features-grid">
                {FEATURES.map((feature, idx) => (
                  <Card key={idx} className="border-0 shadow-sm hover:shadow-md transition-all group" data-testid={`coaching-feature-card-${idx}`}>
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

        <section className="py-14 px-4" data-testid="coaching-dashboard-preview-section">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-8">
              <div>
                <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }} data-testid="badge-coaching-preview">
                  Dashboard Preview
                </Badge>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }} data-testid="text-coaching-preview-title">
                  Your Institute Dashboard
                </h2>
                <p className="mt-1.5 text-sm max-w-xl" style={{ color: 'var(--text-secondary)' }} data-testid="text-coaching-preview-desc">
                  Real-time batch analytics, readiness scores, and stress indicators for every student
                </p>
              </div>
              <Button
                variant="outline"
                className="font-medium px-5 h-9 rounded-lg shrink-0 text-sm"
                style={{ borderColor: BRAND.primary, color: BRAND.primary }}
                onClick={() => onNavigate('request-demo')}
                data-testid="btn-coaching-preview-demo"
              >
                <Play size={13} className="mr-1.5" /> Request Live Demo
              </Button>
            </div>

            <div className="grid lg:grid-cols-5 gap-5">
              <div className="lg:col-span-3">
                <Card className="border-0 shadow-md h-full overflow-hidden" data-testid="coaching-dashboard-mockup">
                  <div className="px-4 py-2.5 flex items-center justify-between border-b" style={{ backgroundColor: BRAND.primary }}>
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}30` }}>
                        <Target size={14} style={{ color: BRAND.accent }} />
                      </div>
                      <div className="text-white">
                        <p className="text-xs font-bold">Institute Dashboard</p>
                        <p className="text-[9px] text-white/55">JEE Batch · 2025 · 86 students</p>
                      </div>
                    </div>
                    <Badge className="bg-white/15 text-white border-0 text-[9px] px-2 py-0.5" data-testid="badge-coaching-dash-live">Live</Badge>
                  </div>
                  <CardContent className="p-4 space-y-4" style={{ backgroundColor: '#fafbfc' }}>
                    <div>
                      <p className="text-[10px] font-bold mb-2 uppercase tracking-wider" style={{ color: BRAND.primary }}>Batch Readiness Overview</p>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { label: 'Avg Readiness', value: '71.2', trend: '+4.1' },
                          { label: 'Stress Level', value: '34%', trend: '-6.2' },
                          { label: 'Confidence', value: '76.5', trend: '+2.8' },
                          { label: 'At Risk', value: '8', trend: '-3' },
                        ].map((m, i) => (
                          <div key={i} className="p-2.5 rounded-lg border" data-testid={`coaching-dash-metric-${i}`}>
                            <p className="text-[9px] font-medium mb-0.5" style={{ color: 'var(--text-secondary)' }}>{m.label}</p>
                            <p className="text-base font-bold" style={{ color: BRAND.primary }}>{m.value}</p>
                            <p className="text-[9px] font-semibold" style={{ color: BRAND.accent }}>
                              {m.trend.startsWith('-') ? '↓' + m.trend.slice(1) : '↑' + m.trend}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold mb-2 uppercase tracking-wider" style={{ color: BRAND.primary }}>Key Readiness Dimensions</p>
                      <div className="space-y-2">
                        {[
                          { dim: 'Cognitive Readiness', score: 76 },
                          { dim: 'Emotional Regulation', score: 68 },
                          { dim: 'Time Management', score: 73 },
                          { dim: 'Stress Tolerance', score: 61 },
                          { dim: 'Study Discipline', score: 79 },
                        ].map((d, i) => (
                          <div key={i} className="flex items-center gap-2" data-testid={`coaching-dash-dim-${i}`}>
                            <span className="text-[11px] font-medium w-36 shrink-0" style={{ color: 'var(--text-primary)' }}>{d.dim}</span>
                            <div className="flex-1 h-2 rounded-full" style={{ backgroundColor: `${BRAND.accent}12` }}>
                              <div className="h-full rounded-full" style={{ width: `${d.score}%`, backgroundColor: d.score >= 70 ? BRAND.accent : BRAND.primary }} />
                            </div>
                            <span className="text-[11px] font-bold w-7 text-right" style={{ color: d.score >= 70 ? BRAND.accent : BRAND.primary }}>{d.score}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 p-2.5 rounded-lg border" style={{ borderColor: `${BRAND.accent}25` }} data-testid="coaching-dash-insight">
                      <Sparkles size={14} style={{ color: BRAND.accent }} />
                      <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                        <span className="font-semibold" style={{ color: BRAND.primary }}>AI Alert:</span> 8 students show stress escalation patterns. Recommend counselor check-in before mock exams.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-2 space-y-4">
                <Card className="border-0 shadow-md" data-testid="coaching-quick-actions">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}12` }}>
                        <Zap size={16} style={{ color: BRAND.accent }} />
                      </div>
                      <h3 className="font-bold text-sm" style={{ color: BRAND.primary }}>Quick Actions</h3>
                    </div>
                    <div className="space-y-2">
                      {[
                        'Schedule mock readiness test',
                        'Generate batch report',
                        'View at-risk students',
                        'Stress trend analysis',
                        'Send parent alerts',
                      ].map((action, idx) => (
                        <div key={idx} className="flex items-center gap-2.5 p-2.5 rounded-lg border hover:shadow-sm transition-all cursor-pointer group" data-testid={`coaching-action-${idx}`}>
                          <div className="h-6 w-6 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.primary}06` }}>
                            <ChevronRight size={12} style={{ color: BRAND.primary }} />
                          </div>
                          <span className="text-xs font-medium flex-1" style={{ color: 'var(--text-primary)' }}>{action}</span>
                          <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: BRAND.accent }} />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-md" data-testid="coaching-batch-coverage">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}08` }}>
                        <Target size={16} style={{ color: BRAND.primary }} />
                      </div>
                      <h3 className="font-bold text-sm" style={{ color: BRAND.primary }}>Batch Coverage</h3>
                    </div>
                    <div className="space-y-2.5">
                      {[
                        { label: 'Students Assessed', pct: 91 },
                        { label: 'Readiness Scored', pct: 87 },
                        { label: 'Reports Delivered', pct: 95 },
                      ].map((item, idx) => (
                        <div key={idx} data-testid={`coaching-coverage-${idx}`}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{item.label}</span>
                            <span className="font-bold" style={{ color: BRAND.accent }}>{item.pct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full" style={{ backgroundColor: `${BRAND.accent}12` }}>
                            <div className="h-full rounded-full" style={{ width: `${item.pct}%`, backgroundColor: BRAND.accent }} />
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

        <section className="py-14 px-4" style={{ backgroundColor: 'var(--bg-secondary)' }} data-testid="coaching-use-cases-section">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }} data-testid="badge-coaching-use-cases">
                Exam Categories
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }} data-testid="text-coaching-use-cases-title">
                Tailored for Every Exam Category
              </h2>
              <p className="mt-2 text-sm max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }} data-testid="text-coaching-use-cases-desc">
                Specialized behavioral intelligence for different competitive exam preparation contexts
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {USE_CASES.map((uc, idx) => (
                <Card key={idx} className="border-0 shadow-sm hover:shadow-md transition-all overflow-hidden group" data-testid={`coaching-use-case-${idx}`}>
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

        <section className="py-14 px-4" data-testid="coaching-testimonials-section">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }} data-testid="badge-coaching-testimonials">
                Institute Leaders Say
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }} data-testid="text-coaching-testimonials-title">
                Trusted by Top Coaching Institutes
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
              {TESTIMONIALS.map((t, idx) => (
                <Card key={idx} className="border-0 shadow-sm hover:shadow-md transition-all" data-testid={`coaching-testimonial-${idx}`}>
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

        <section className="py-14 px-4" style={{ backgroundColor: 'var(--bg-secondary)' }} data-testid="coaching-how-it-works-section">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }} data-testid="badge-coaching-how">
                Simple Onboarding
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }} data-testid="text-coaching-how-title">
                Get Started in 3 Steps
              </h2>
              <p className="mt-2 text-sm max-w-lg mx-auto" style={{ color: 'var(--text-secondary)' }} data-testid="text-coaching-how-desc">
                From institute registration to actionable readiness insights
              </p>
            </div>

            <div className="relative">
              <div className="hidden md:block absolute top-14 left-[16%] right-[16%] h-px" style={{ backgroundColor: `${BRAND.accent}20` }} />
              <div className="grid md:grid-cols-3 gap-6">
                {HOW_IT_WORKS.map((step) => (
                  <div key={step.step} className="relative text-center" data-testid={`coaching-step-${step.step}`}>
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

        <section className="py-16 px-4" style={{ backgroundColor: BRAND.primary }} data-testid="coaching-cta-section">
          <div className="max-w-3xl mx-auto text-center">
            <div className="h-12 w-12 rounded-xl bg-white/12 flex items-center justify-center mx-auto mb-5">
              <Target size={24} className="text-white" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 tracking-tight" data-testid="text-coaching-cta">
              Optimize Your Students' <span style={{ color: BRAND.accent }}>Exam Readiness</span>
            </h2>
            <p className="text-white/65 text-sm mb-8 max-w-lg mx-auto leading-relaxed" data-testid="text-coaching-cta-desc">
              Join leading coaching institutes using MetryxOne to transform how students prepare for competitive exams.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 mb-6">
              <Button
                className="h-10 px-8 font-medium text-sm rounded-lg text-white"
                style={{ backgroundColor: BRAND.accent }}
                onClick={() => onNavigate('request-demo')}
                data-testid="btn-coaching-cta-demo"
              >
                Request a Demo <ArrowRight size={15} className="ml-1.5" />
              </Button>
              <Button
                variant="outline"
                className="h-10 px-8 font-medium text-sm border-white/25 text-white hover:bg-white/10 rounded-lg"
                onClick={() => onNavigate('support')}
                data-testid="btn-coaching-cta-contact"
              >
                Contact Sales
              </Button>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-white/50 text-xs" data-testid="coaching-cta-trust">
              <span className="flex items-center gap-1.5" data-testid="cta-trust-institutes"><Target size={13} /> 200+ institutes onboarded</span>
              <span className="flex items-center gap-1.5" data-testid="cta-trust-exams"><CheckCircle size={13} /> JEE, NEET, UPSC ready</span>
              <span className="flex items-center gap-1.5" data-testid="cta-trust-free"><Shield size={13} /> Free consultation</span>
            </div>
          </div>
        </section>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
