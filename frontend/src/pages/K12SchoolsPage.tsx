import {
  School, CheckCircle, Shield, ArrowRight, ArrowDown, Target,
  BookOpen, Users, Brain, Award, Zap, BarChart3, Lock,
  GraduationCap, TrendingUp, Sparkles, Eye, Heart, Layers,
  ClipboardCheck, FileText, CheckCircle2,
  ChevronRight, Play, Star
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
  { icon: Brain, title: 'LBI Assessment Engine', desc: 'Full 19-domain, 97-subdomain behavioral intelligence covering cognitive, emotional, social, and metacognitive dimensions.' },
  { icon: TrendingUp, title: 'Longitudinal Tracking', desc: 'Track behavioral patterns across semesters and years with trend analysis and early warning systems.' },
  { icon: Target, title: 'ExamReadiness Index™', desc: 'Measure psychological exam readiness — stress response, confidence, time management — before every test.' },
  { icon: Heart, title: 'Wellbeing Dashboard', desc: 'Real-time cohort and individual views of mental health indicators, social-emotional functioning, and adjustment.' },
  { icon: Users, title: 'Parent Engagement', desc: 'Automated parent communication with personalized insights, progress reports, and actionable home-support tips.' },
  { icon: Shield, title: 'Compliance & Consent', desc: 'DPDP Act compliant with consent workflows, data encryption, SOC2 controls, and audit trails.' },
];

const AGE_BANDS = [
  {
    band: 'A', range: '6-10 yrs', label: 'Primary', color: BRAND.accent, icon: BookOpen,
    items: ['Foundational learning pattern assessment', 'Early cognitive habit identification', 'Social-emotional development baselines', 'Attention span & engagement tracking', 'Play-based behavioral observation', 'Parent-teacher behavioral alignment'],
    stat: '12 domains active',
  },
  {
    band: 'B', range: '11-14 yrs', label: 'Middle School', color: BRAND.primary, icon: GraduationCap,
    items: ['Critical developmental period tracking', 'Exam stress & anxiety monitoring', 'Peer comparison sensitivity mapping', 'Academic identity formation analysis', 'Self-regulation maturity scoring', 'Digital behavior impact assessment'],
    stat: '17 domains active',
  },
  {
    band: 'C', range: '15-18 yrs', label: 'High School', color: '#8b5cf6', icon: Target,
    items: ['Competitive exam psychological readiness', 'Career alignment & aptitude signals', 'Metacognitive maturity profiling', 'Complex stress management insights', 'Leadership & collaboration metrics', 'College readiness behavioral index'],
    stat: 'All 19 domains active',
  },
];

const OUTCOMES = [
  { metric: '34%', label: 'Improvement in student wellbeing scores', icon: Heart },
  { metric: '28%', label: 'Reduction in exam-related anxiety', icon: Shield },
  { metric: '41%', label: 'Increase in parent engagement rates', icon: Users },
  { metric: '3.2x', label: 'Faster early intervention identification', icon: Zap },
];

const TESTIMONIALS = [
  { quote: 'MetryxOne helped us identify students struggling with emotional regulation before it affected their grades. The age-band approach is exactly what schools need.', name: 'Dr. Meera Sharma', role: 'Principal, Delhi Public School', avatar: 'MS' },
  { quote: 'The LBI reports give us actionable insights we never had before. We\'ve reduced counselor caseloads by focusing on data-driven interventions.', name: 'Rajesh Patel', role: 'Academic Director, Vibgyor Group', avatar: 'RP' },
  { quote: 'Parents love the reports. For the first time, they understand their child\'s learning behavior beyond just marks and grades.', name: 'Ananya Krishnan', role: 'Vice Principal, Kendriya Vidyalaya', avatar: 'AK' },
];

export function K12SchoolsPage({ onNavigate }: Props) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Navbar onNavigate={onNavigate} currentScreen="k12-schools" />

      <main className="flex-1 pt-20">
        <section className="relative py-14 md:py-20 px-4 overflow-hidden" style={{ backgroundColor: BRAND.primary }} data-testid="k12-hero-section">
          <div className="absolute inset-0 opacity-[0.05]">
            <div className="absolute top-12 left-[8%] w-48 h-48 rounded-full border border-white" />
            <div className="absolute bottom-12 right-[6%] w-72 h-72 rounded-full border border-white" />
            <div className="absolute top-[30%] right-[25%] w-32 h-32 rounded-full border border-white" />
          </div>

          <div className="max-w-6xl mx-auto relative">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="text-white">
                <div className="flex items-center gap-2 mb-5">
                  <Badge className="bg-white/15 text-white border-0 text-xs px-3 py-1.5 font-medium" data-testid="badge-k12-solution">
                    <School size={12} className="mr-1" /> K-12 Solution
                  </Badge>
                  <Badge className="bg-white/15 text-white border-0 text-xs px-3 py-1.5 font-medium" data-testid="badge-k12-ages">
                    Ages 6-18
                  </Badge>
                  <Badge className="border-0 text-xs px-3 py-1.5 font-semibold" style={{ backgroundColor: BRAND.accent, color: '#fff' }} data-testid="badge-k12-nep">
                    NEP 2020
                  </Badge>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold mb-3 leading-tight tracking-tight" data-testid="text-k12-title">
                  K-12 Schools
                </h1>
                <p className="text-base font-medium mb-2 text-white/90 leading-relaxed" data-testid="text-k12-subtitle">
                  Student Wellbeing & Learning Pattern Insights for All Grades
                </p>
                <p className="text-sm text-white/65 mb-6 leading-relaxed max-w-md" data-testid="text-k12-desc">
                  Empower your school with comprehensive behavioral intelligence. Understand how every student
                  thinks, learns, and performs — with age-adaptive assessments and actionable insights
                  for teachers, counselors, and parents.
                </p>
                <div className="flex flex-col sm:flex-row gap-2.5 mb-6">
                  <Button
                    className="text-white font-medium h-10 px-6 text-sm rounded-lg"
                    style={{ backgroundColor: BRAND.accent }}
                    onClick={() => onNavigate('request-demo')}
                    data-testid="btn-k12-get-started"
                  >
                    Get a School Quote <ArrowRight size={15} className="ml-1.5" />
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/25 text-white hover:bg-white/10 h-10 px-6 text-sm font-medium rounded-lg"
                    onClick={() => onNavigate('lbi-product')}
                    data-testid="btn-k12-learn-more"
                  >
                    Explore LBI Framework
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-xs text-white/70 font-medium" data-testid="k12-trust-badges">
                  <span className="flex items-center gap-1.5" data-testid="trust-dpdp">
                    <CheckCircle size={13} style={{ color: BRAND.accent }} /> DPDP Compliant
                  </span>
                  <span className="flex items-center gap-1.5" data-testid="trust-soc2">
                    <Shield size={13} style={{ color: BRAND.accent }} /> SOC2 Certified
                  </span>
                  <span className="flex items-center gap-1.5" data-testid="trust-bulk">
                    <Zap size={13} style={{ color: BRAND.accent }} /> Bulk Pricing
                  </span>
                  <span className="flex items-center gap-1.5" data-testid="trust-support">
                    <Users size={13} style={{ color: BRAND.accent }} /> Dedicated Support
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: School, value: '500+', label: 'Partner Schools', sub: 'across India' },
                    { icon: Layers, value: '19', label: 'LBI Domains', sub: '97 subdomains' },
                  ].map((stat, idx) => (
                    <Card key={idx} className="bg-white/10 border-0" data-testid={`k12-stat-card-${idx}`}>
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
                    { icon: FileText, value: '97', label: 'Subdomains', sub: 'granular analysis' },
                    { icon: BarChart3, value: '3', label: 'Age Bands', sub: '6-10, 11-14, 15-18' },
                  ].map((stat, idx) => (
                    <Card key={idx + 2} className="bg-white/10 border-0" data-testid={`k12-stat-card-${idx + 2}`}>
                      <CardContent className="p-4 text-center text-white">
                        <stat.icon size={22} className="mx-auto mb-2" style={{ color: BRAND.accent }} />
                        <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                        <p className="text-xs font-semibold text-white/85 mt-0.5">{stat.label}</p>
                        <p className="text-[10px] text-white/45 mt-0.5">{stat.sub}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Card className="bg-white/10 border-0" data-testid="k12-compliance-card">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 text-white">
                      <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.accent}25` }}>
                        <Award size={20} style={{ color: BRAND.accent }} />
                      </div>
                      <div>
                        <p className="text-xs font-bold">NEP 2020 Aligned & DPDP Compliant</p>
                        <p className="text-[10px] text-white/55">Enterprise-grade privacy and compliance for schools</p>
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

        <section className="py-10 px-4" data-testid="k12-value-strip">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Brain, label: 'Learning Behavior Index', text: 'Comprehensive 19-domain behavioral assessment for every student' },
                { icon: BarChart3, label: 'Age-Band Segmented', text: 'Calibrated assessments for 6-10, 11-14, and 15-18 age groups' },
                { icon: Eye, label: 'Teacher-Friendly', text: 'Intuitive dashboards designed for educators, not data scientists' },
                { icon: Lock, label: 'Privacy-First', text: 'DPDP Act compliant with built-in consent management' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: `${BRAND.primary}04` }} data-testid={`k12-value-item-${i}`}>
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

        <section className="py-14 px-4" style={{ backgroundColor: 'var(--bg-secondary)' }} data-testid="k12-features-section">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-5 gap-10 items-start">
              <div className="lg:col-span-2">
                <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.accent}20`, color: BRAND.accent }} data-testid="badge-k12-features">
                  Platform Capabilities
                </Badge>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-3" style={{ color: BRAND.primary }} data-testid="text-k12-features-title">
                  Everything Your School Needs
                </h2>
                <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
                  A complete behavioral intelligence platform built for K-12 institutions.
                  From assessment to intervention, MetryxOne covers the entire student development lifecycle.
                </p>
                <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
                  Every feature is designed with teachers in mind — intuitive, actionable,
                  and integrated with your existing school workflows.
                </p>
                <Button
                  className="font-medium px-6 h-9 rounded-lg text-white text-sm"
                  style={{ backgroundColor: BRAND.accent }}
                  onClick={() => onNavigate('request-demo')}
                  data-testid="btn-features-demo"
                >
                  <Play size={14} className="mr-1.5" /> See It in Action
                </Button>
              </div>
              <div className="lg:col-span-3 grid sm:grid-cols-2 gap-4" data-testid="k12-features-grid">
                {FEATURES.map((feature, idx) => (
                  <Card key={idx} className="border-0 shadow-sm hover:shadow-md transition-all group" data-testid={`k12-feature-card-${idx}`}>
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

        <section className="py-14 px-4" data-testid="k12-dashboard-preview-section">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-8">
              <div>
                <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }} data-testid="badge-k12-preview">
                  Dashboard Preview
                </Badge>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }} data-testid="text-k12-preview-title">
                  Your School Dashboard
                </h2>
                <p className="mt-1.5 text-sm max-w-xl" style={{ color: 'var(--text-secondary)' }} data-testid="text-k12-preview-desc">
                  Real-time cohort analytics, student profiles, and domain-level breakdowns — all in one place
                </p>
              </div>
              <Button
                variant="outline"
                className="font-medium px-5 h-9 rounded-lg shrink-0 text-sm"
                style={{ borderColor: BRAND.primary, color: BRAND.primary }}
                onClick={() => onNavigate('request-demo')}
                data-testid="btn-preview-demo"
              >
                <Play size={13} className="mr-1.5" /> Request Live Demo
              </Button>
            </div>

            <div className="grid lg:grid-cols-5 gap-5">
              <div className="lg:col-span-3">
                <Card className="border-0 shadow-md h-full overflow-hidden" data-testid="k12-dashboard-mockup">
                  <div className="px-4 py-2.5 flex items-center justify-between border-b" style={{ backgroundColor: BRAND.primary }}>
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}30` }}>
                        <School size={14} style={{ color: BRAND.accent }} />
                      </div>
                      <div className="text-white">
                        <p className="text-xs font-bold">School Dashboard</p>
                        <p className="text-[9px] text-white/55">Grade 8 · 2025-26 · 142 students</p>
                      </div>
                    </div>
                    <Badge className="bg-white/15 text-white border-0 text-[9px] px-2 py-0.5" data-testid="badge-dashboard-live">Live</Badge>
                  </div>
                  <CardContent className="p-4 space-y-4" style={{ backgroundColor: '#fafbfc' }}>
                    <div>
                      <p className="text-[10px] font-bold mb-2 uppercase tracking-wider" style={{ color: BRAND.primary }}>Cohort LBI Overview</p>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { label: 'Avg LBI', value: '72.4', trend: '+3.2' },
                          { label: 'Wellbeing', value: '68.1', trend: '+5.7' },
                          { label: 'Exam Ready', value: '74.8', trend: '+1.9' },
                          { label: 'At Risk', value: '12', trend: '-4' },
                        ].map((m, i) => (
                          <div key={i} className="p-2.5 rounded-lg border" data-testid={`dashboard-metric-${i}`}>
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
                      <p className="text-[10px] font-bold mb-2 uppercase tracking-wider" style={{ color: BRAND.primary }}>Top 5 Domain Scores</p>
                      <div className="space-y-2">
                        {[
                          { domain: 'D01 Academic Effectiveness', score: 78 },
                          { domain: 'D05 Social Interaction', score: 74 },
                          { domain: 'D07 Discipline & Habits', score: 71 },
                          { domain: 'D12 Curiosity & Exploration', score: 69 },
                          { domain: 'D03 Emotional Regulation', score: 62 },
                        ].map((d, i) => (
                          <div key={i} className="flex items-center gap-2" data-testid={`dashboard-domain-${i}`}>
                            <span className="text-[11px] font-medium w-44 shrink-0" style={{ color: 'var(--text-primary)' }}>{d.domain}</span>
                            <div className="flex-1 h-2 rounded-full" style={{ backgroundColor: `${BRAND.accent}12` }}>
                              <div className="h-full rounded-full" style={{ width: `${d.score}%`, backgroundColor: d.score >= 70 ? BRAND.accent : BRAND.primary }} />
                            </div>
                            <span className="text-[11px] font-bold w-7 text-right" style={{ color: d.score >= 70 ? BRAND.accent : BRAND.primary }}>{d.score}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 p-2.5 rounded-lg border" style={{ borderColor: `${BRAND.accent}25` }} data-testid="dashboard-ai-insight">
                      <Sparkles size={14} style={{ color: BRAND.accent }} />
                      <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                        <span className="font-semibold" style={{ color: BRAND.primary }}>AI Insight:</span> D03 Emotional Regulation declined 8% this quarter. Consider intervention for 23 flagged students.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-2 space-y-4">
                <Card className="border-0 shadow-md" data-testid="k12-quick-actions">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}12` }}>
                        <Zap size={16} style={{ color: BRAND.accent }} />
                      </div>
                      <h3 className="font-bold text-sm" style={{ color: BRAND.primary }}>Quick Actions</h3>
                    </div>
                    <div className="space-y-2">
                      {[
                        'Schedule batch assessment',
                        'Generate cohort report',
                        'View at-risk students',
                        'Send parent updates',
                        'Export compliance log',
                        'Configure age bands',
                      ].map((action, idx) => (
                        <div key={idx} className="flex items-center gap-2.5 p-2.5 rounded-lg border hover:shadow-sm transition-all cursor-pointer group" data-testid={`quick-action-${idx}`}>
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

                <Card className="border-0 shadow-md" data-testid="k12-assessment-coverage">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}08` }}>
                        <Target size={16} style={{ color: BRAND.primary }} />
                      </div>
                      <h3 className="font-bold text-sm" style={{ color: BRAND.primary }}>Coverage Stats</h3>
                    </div>
                    <div className="space-y-2.5">
                      {[
                        { label: 'Students Assessed', pct: 94 },
                        { label: 'Parent Consent', pct: 88 },
                        { label: 'Report Delivery', pct: 97 },
                      ].map((item, idx) => (
                        <div key={idx} data-testid={`coverage-stat-${idx}`}>
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

        <section className="py-14 px-4" style={{ backgroundColor: 'var(--bg-secondary)' }} data-testid="k12-age-bands-section">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }} data-testid="badge-k12-age-bands">
                Age-Adaptive Assessment
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }} data-testid="text-k12-age-bands-title">
                Calibrated for Every Developmental Stage
              </h2>
              <p className="mt-2 text-sm max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }} data-testid="text-k12-age-bands-desc">
                LBI assessments adapt to each age band with developmentally appropriate questions and validated scoring
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {AGE_BANDS.map((band, idx) => (
                <Card key={idx} className="border-0 shadow-sm hover:shadow-md transition-all overflow-hidden group" data-testid={`k12-age-band-${band.band}`}>
                  <div className="h-1.5" style={{ backgroundColor: band.color }} />
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2.5 mb-4">
                      <div
                        className="h-11 w-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
                        style={{ backgroundColor: `${band.color}10` }}
                      >
                        <band.icon size={22} style={{ color: band.color }} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Band {band.band}</h3>
                        <p className="text-xs font-medium" style={{ color: band.color }}>{band.range} · {band.label}</p>
                      </div>
                    </div>
                    <div className="space-y-2 mb-4">
                      {band.items.map((item) => (
                        <div key={item} className="flex items-start gap-2">
                          <CheckCircle2 size={13} className="shrink-0 mt-0.5" style={{ color: band.color }} />
                          <span className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{item}</span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-3 border-t" style={{ borderColor: `${band.color}12` }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: band.color }}>{band.stat}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 px-4" data-testid="k12-outcomes-section">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }} data-testid="badge-k12-outcomes">
                Proven Results
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }} data-testid="text-k12-outcomes-title">
                Measurable School Impact
              </h2>
              <p className="mt-2 text-sm max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }} data-testid="text-k12-outcomes-desc">
                Schools using MetryxOne report significant improvements across student wellbeing and engagement
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {OUTCOMES.map((outcome, idx) => (
                <Card key={idx} className="border-0 shadow-sm text-center hover:shadow-md transition-all" data-testid={`k12-outcome-${idx}`}>
                  <CardContent className="p-5">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: `${BRAND.accent}10` }}>
                      <outcome.icon size={20} style={{ color: BRAND.accent }} />
                    </div>
                    <p className="text-2xl font-bold tracking-tight mb-1" style={{ color: BRAND.primary }}>{outcome.metric}</p>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{outcome.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-14 px-4" style={{ backgroundColor: 'var(--bg-secondary)' }} data-testid="k12-testimonials-section">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }} data-testid="badge-k12-testimonials">
                School Leaders Say
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }} data-testid="text-k12-testimonials-title">
                Trusted by Educators Nationwide
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {TESTIMONIALS.map((t, idx) => (
                <Card key={idx} className="border-0 shadow-sm hover:shadow-md transition-all" data-testid={`k12-testimonial-${idx}`}>
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

        <section className="py-14 px-4" data-testid="k12-how-it-works-section">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }} data-testid="badge-k12-how">
                Simple Onboarding
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }} data-testid="text-k12-how-title">
                Get Started in 3 Steps
              </h2>
              <p className="mt-2 text-sm max-w-lg mx-auto" style={{ color: 'var(--text-secondary)' }} data-testid="text-k12-how-desc">
                From school registration to actionable insights — we make onboarding effortless
              </p>
            </div>

            <div className="relative">
              <div className="hidden md:block absolute top-14 left-[16%] right-[16%] h-px" style={{ backgroundColor: `${BRAND.accent}20` }} />
              <div className="grid md:grid-cols-3 gap-6">
                {[
                  { step: '1', title: 'Onboard School', desc: 'Register your institution, configure age bands and grade mappings, set up access, and establish consent workflows.', icon: ClipboardCheck },
                  { step: '2', title: 'Assess Students', desc: 'Deploy age-adaptive LBI assessments across all grades. AI-powered question flow adapts to each student.', icon: Brain },
                  { step: '3', title: 'Track & Improve', desc: 'Access cohort dashboards, individual reports, trend analysis, and evidence-based intervention recommendations.', icon: BarChart3 },
                ].map((step) => (
                  <div key={step.step} className="relative text-center" data-testid={`k12-step-${step.step}`}>
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

        <section className="py-16 px-4" style={{ backgroundColor: BRAND.primary }} data-testid="k12-cta-section">
          <div className="max-w-3xl mx-auto text-center">
            <div className="h-12 w-12 rounded-xl bg-white/12 flex items-center justify-center mx-auto mb-5">
              <School size={24} className="text-white" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 tracking-tight" data-testid="text-k12-cta">
              Transform Your School's <span style={{ color: BRAND.accent }}>Student Insights</span>
            </h2>
            <p className="text-white/65 text-sm mb-8 max-w-lg mx-auto leading-relaxed" data-testid="text-k12-cta-desc">
              Join 500+ schools using MetryxOne to understand student wellbeing
              and learning patterns at scale. Get a free consultation and custom quote.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 mb-6">
              <Button
                className="h-10 px-8 font-medium text-sm rounded-lg text-white"
                style={{ backgroundColor: BRAND.accent }}
                onClick={() => onNavigate('request-demo')}
                data-testid="btn-k12-cta-demo"
              >
                Request a Demo <ArrowRight size={15} className="ml-1.5" />
              </Button>
              <Button
                variant="outline"
                className="h-10 px-8 font-medium text-sm border-white/25 text-white hover:bg-white/10 rounded-lg"
                onClick={() => onNavigate('support')}
                data-testid="btn-k12-cta-contact"
              >
                Contact Sales
              </Button>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-white/50 text-xs" data-testid="k12-cta-trust">
              <span className="flex items-center gap-1.5" data-testid="cta-trust-schools"><School size={13} /> 500+ schools onboarded</span>
              <span className="flex items-center gap-1.5" data-testid="cta-trust-compliance"><Shield size={13} /> DPDP & SOC2 compliant</span>
              <span className="flex items-center gap-1.5" data-testid="cta-trust-free"><CheckCircle size={13} /> Free consultation</span>
            </div>
          </div>
        </section>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
