import { BRAND } from '@/design-system/tokens';
import {
  Briefcase, CheckCircle, Shield, ArrowRight, ArrowDown,
  Users, Brain, Award, Zap, BarChart3,
  GraduationCap, TrendingUp, Sparkles, Layers,
  ClipboardCheck, Target, Heart, UserCheck, Settings,
  FileText, Activity, Search, ChevronRight, CheckCircle2,
  Star, Play, PieChart, Eye
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



const FEATURES = [
  { icon: Brain, title: 'Behavioral Competency Profiling', desc: 'Map candidates across 19 behavioral domains and 97 competency signals — understand how they think, collaborate, and perform under pressure.' },
  { icon: Heart, title: 'Culture Fit Assessment', desc: 'Scientifically measure alignment between candidate behavioral patterns and your organization\'s culture, values, and team dynamics.' },
  { icon: TrendingUp, title: 'Cognitive Potential Mapping', desc: 'Assess analytical thinking, problem-solving aptitude, learning agility, and adaptability using AI-powered cognitive assessments.' },
  { icon: Target, title: 'Role-Specific Assessment Design', desc: 'Configure assessments tailored to specific roles, seniority levels, and functional requirements. 50+ pre-built role templates.' },
  { icon: Settings, title: 'ATS / HRMS Integration', desc: 'Seamless integration with popular ATS and HRMS platforms. Auto-sync candidate data, trigger assessments, and surface insights.' },
  { icon: Users, title: 'Bulk Candidate Processing', desc: 'Assess hundreds of candidates simultaneously with automated scheduling, proctoring, and report generation for campus drives.' },
];

const USE_CASES = [
  {
    icon: GraduationCap, title: 'Graduate Hiring', color: BRAND.accent,
    items: ['Identify potential beyond GPA and university', 'Assess learning agility and cognitive readiness', 'Behavioral profiling for professional environments', 'Scale to 500+ candidates per campus drive'],
  },
  {
    icon: Briefcase, title: 'Lateral Hiring', color: BRAND.primary,
    items: ['Evaluate role fit and culture alignment', 'Leadership potential and EQ assessment', 'Reduce mis-hires with behavioral profiling', 'Benchmark against top-performer profiles'],
  },
  {
    icon: Award, title: 'Leadership Assessment', color: '#8b5cf6',
    items: ['Strategic thinking and vision assessment', 'Emotional intelligence deep-dive', 'Team management capability scoring', 'Executive readiness indicators'],
  },
];

const HOW_IT_WORKS = [
  { step: 1, title: 'Define Role Profile', desc: 'Configure the ideal behavioral competency profile. Select domains, set thresholds, and define culture-fit parameters.', icon: ClipboardCheck },
  { step: 2, title: 'Assess Candidates', desc: 'Invite candidates to complete AI-adaptive assessments. Automated scheduling, proctoring, and real-time tracking.', icon: Brain },
  { step: 3, title: 'Hire with Confidence', desc: 'Review comprehensive reports with competency scores, culture-fit indices, and AI-generated hiring recommendations.', icon: UserCheck },
];

const TESTIMONIALS = [
  { quote: 'MetryxOne helped us reduce our graduate hiring mis-rate by 34%. The behavioral profiling revealed patterns we completely missed in interviews.', name: 'Ankit Mehta', role: 'VP Talent Acquisition, TechCorp India', avatar: 'AM' },
  { quote: 'We assessed 1,200 campus candidates in a single week. The culture-fit scores saved us weeks of manual evaluation.', name: 'Sneha Kapoor', role: 'Head of HR, FinServe Ltd', avatar: 'SK' },
];

const IMPACT_STATS = [
  { value: '34%', label: 'Reduction in mis-hires', icon: TrendingUp },
  { value: '2.5x', label: 'Faster hiring decisions', icon: Zap },
  { value: '89%', label: 'Hiring manager satisfaction', icon: Star },
  { value: '60%', label: 'Lower attrition (Year 1)', icon: Heart },
];

export function EnterpriseHiringPage({ onNavigate }: Props) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Navbar onNavigate={onNavigate} currentScreen="enterprise-hiring" />

      <main className="flex-1 pt-20">
        <section className="relative py-14 md:py-20 px-4 overflow-hidden" style={{ backgroundColor: BRAND.primary }} data-testid="hiring-hero-section">
          <div className="absolute inset-0 opacity-[0.05]">
            <div className="absolute top-12 left-[8%] w-48 h-48 rounded-full border border-white" />
            <div className="absolute bottom-12 right-[6%] w-72 h-72 rounded-full border border-white" />
            <div className="absolute top-[30%] right-[25%] w-32 h-32 rounded-full border border-white" />
          </div>

          <div className="max-w-6xl mx-auto relative">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="text-white">
                <div className="flex items-center gap-2 mb-5">
                  <Badge className="bg-white/15 text-white border-0 text-xs px-3 py-1.5 font-medium" data-testid="badge-hiring-solution">
                    <Briefcase size={12} className="mr-1" /> Solution
                  </Badge>
                  <Badge className="border-0 text-xs px-3 py-1.5 font-semibold" style={{ backgroundColor: `${BRAND.accent}30`, color: BRAND.accent }} data-testid="badge-hiring-enterprise">
                    ENTERPRISE
                  </Badge>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold mb-3 leading-tight tracking-tight" data-testid="text-hiring-title">
                  Talent Assessment
                </h1>
                <p className="text-base font-medium mb-2 text-white/90 leading-relaxed" data-testid="text-hiring-subtitle">
                  Hire Based on Potential, Not Just Resumes
                </p>
                <p className="text-sm text-white/65 mb-6 leading-relaxed max-w-md" data-testid="text-hiring-desc">
                  Transform your hiring process with behavioral intelligence. Assess candidates
                  across 19 behavioral domains, predict job performance, and build high-performing
                  teams with data-driven confidence.
                </p>
                <div className="flex flex-col sm:flex-row gap-2.5 mb-6">
                  <Button
                    className="text-white font-medium h-10 px-6 text-sm rounded-lg"
                    style={{ backgroundColor: BRAND.accent }}
                    onClick={() => onNavigate('request-demo')}
                    data-testid="btn-hiring-get-started"
                  >
                    Get Started <ArrowRight size={15} className="ml-1.5" />
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/25 text-white hover:bg-white/10 h-10 px-6 text-sm font-medium rounded-lg"
                    onClick={() => onNavigate('lbi-product')}
                    data-testid="btn-hiring-learn-more"
                  >
                    Learn About LBI
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-xs text-white/70 font-medium" data-testid="hiring-trust-badges">
                  <span className="flex items-center gap-1.5" data-testid="trust-bias-free">
                    <CheckCircle size={13} style={{ color: BRAND.accent }} /> Bias-Free AI
                  </span>
                  <span className="flex items-center gap-1.5" data-testid="trust-dpdp">
                    <Shield size={13} style={{ color: BRAND.accent }} /> DPDP Compliant
                  </span>
                  <span className="flex items-center gap-1.5" data-testid="trust-ats">
                    <CheckCircle size={13} style={{ color: BRAND.accent }} /> ATS Integration
                  </span>
                  <span className="flex items-center gap-1.5" data-testid="trust-bulk">
                    <Zap size={13} style={{ color: BRAND.accent }} /> Bulk Hiring
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Users, value: '10K+', label: 'Candidates Assessed', sub: 'across enterprises' },
                    { icon: Layers, value: '19', label: 'Behavioral Domains', sub: 'comprehensive profiling' },
                  ].map((stat, idx) => (
                    <Card key={idx} className="bg-white/10 border-0" data-testid={`hiring-stat-card-${idx}`}>
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
                    { icon: BarChart3, value: '3', label: 'Assessment Tiers', sub: 'graduate to CXO' },
                  ].map((stat, idx) => (
                    <Card key={idx + 2} className="bg-white/10 border-0" data-testid={`hiring-stat-card-${idx + 2}`}>
                      <CardContent className="p-4 text-center text-white">
                        <stat.icon size={22} className="mx-auto mb-2" style={{ color: BRAND.accent }} />
                        <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                        <p className="text-xs font-semibold text-white/85 mt-0.5">{stat.label}</p>
                        <p className="text-[10px] text-white/45 mt-0.5">{stat.sub}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Card className="bg-white/10 border-0" data-testid="hiring-compliance-card">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 text-white">
                      <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.accent}25` }}>
                        <Award size={20} style={{ color: BRAND.accent }} />
                      </div>
                      <div>
                        <p className="text-xs font-bold">Bias-Free & DPDP Compliant</p>
                        <p className="text-[10px] text-white/55">AI-powered assessments validated for fairness and privacy</p>
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

        <section className="py-10 px-4" data-testid="hiring-impact-strip">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {IMPACT_STATS.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: `${BRAND.primary}04` }} data-testid={`hiring-impact-${i}`}>
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

        <section className="py-14 px-4" style={{ backgroundColor: 'var(--bg-secondary)' }} data-testid="hiring-features-section">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-5 gap-10 items-start">
              <div className="lg:col-span-2">
                <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.accent}20`, color: BRAND.accent }} data-testid="badge-hiring-features">
                  Platform Features
                </Badge>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-3" style={{ color: BRAND.primary }} data-testid="text-hiring-features-title">
                  Hire Smarter, Not Harder
                </h2>
                <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }} data-testid="text-hiring-features-desc">
                  Comprehensive talent assessment tools built for modern enterprise hiring —
                  from campus drives to CXO appointments.
                </p>
                <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
                  Every feature is designed to reduce bias, predict performance, and help you
                  build teams that thrive — not just fill seats.
                </p>
                <Button
                  className="font-medium px-6 h-9 rounded-lg text-white text-sm"
                  style={{ backgroundColor: BRAND.accent }}
                  onClick={() => onNavigate('request-demo')}
                  data-testid="btn-hiring-features-demo"
                >
                  <Play size={14} className="mr-1.5" /> See It in Action
                </Button>
              </div>
              <div className="lg:col-span-3 grid sm:grid-cols-2 gap-4" data-testid="hiring-features-grid">
                {FEATURES.map((feature, idx) => (
                  <Card key={idx} className="border-0 shadow-sm hover:shadow-md transition-all group" data-testid={`hiring-feature-card-${idx}`}>
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

        <section className="py-14 px-4" data-testid="hiring-dashboard-preview-section">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-8">
              <div>
                <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }} data-testid="badge-hiring-preview">
                  Hiring Dashboard
                </Badge>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }} data-testid="text-hiring-preview-title">
                  Your Talent Assessment Console
                </h2>
                <p className="mt-1.5 text-sm max-w-xl" style={{ color: 'var(--text-secondary)' }} data-testid="text-hiring-preview-desc">
                  Candidate profiles, competency scores, culture-fit indices, and AI recommendations — all in one place
                </p>
              </div>
              <Button
                variant="outline"
                className="font-medium px-5 h-9 rounded-lg shrink-0 text-sm"
                style={{ borderColor: BRAND.primary, color: BRAND.primary }}
                onClick={() => onNavigate('request-demo')}
                data-testid="btn-hiring-preview-demo"
              >
                <Play size={13} className="mr-1.5" /> Request Live Demo
              </Button>
            </div>

            <div className="grid lg:grid-cols-5 gap-5">
              <div className="lg:col-span-3">
                <Card className="border-0 shadow-md h-full overflow-hidden" data-testid="hiring-dashboard-mockup">
                  <div className="px-4 py-2.5 flex items-center justify-between border-b" style={{ backgroundColor: BRAND.primary }}>
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}30` }}>
                        <Briefcase size={14} style={{ color: BRAND.accent }} />
                      </div>
                      <div className="text-white">
                        <p className="text-xs font-bold">Hiring Dashboard</p>
                        <p className="text-[9px] text-white/55">Senior Software Engineer · Q1 2026 · 84 applicants</p>
                      </div>
                    </div>
                    <Badge className="bg-white/15 text-white border-0 text-[9px] px-2 py-0.5" data-testid="badge-hiring-dash-live">Active</Badge>
                  </div>
                  <CardContent className="p-4 space-y-4" style={{ backgroundColor: '#fafbfc' }}>
                    <div>
                      <p className="text-[10px] font-bold mb-2 uppercase tracking-wider" style={{ color: BRAND.primary }}>Top Candidates</p>
                      <div className="space-y-2">
                        {[
                          { name: 'Arjun Patel', score: 87, fit: 92, label: 'Strong Match', badge: BRAND.accent },
                          { name: 'Priya Sharma', score: 83, fit: 88, label: 'Strong Match', badge: BRAND.accent },
                          { name: 'Rahul Verma', score: 76, fit: 71, label: 'Good Match', badge: BRAND.primary },
                          { name: 'Neha Gupta', score: 72, fit: 65, label: 'Moderate', badge: '#f59e0b' },
                        ].map((c, i) => (
                          <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border group hover:shadow-sm transition-all" data-testid={`hiring-candidate-${i}`}>
                            <div
                              className="h-8 w-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                              style={{ backgroundColor: BRAND.primary }}
                            >
                              {c.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>LBI: <span className="font-bold" style={{ color: BRAND.primary }}>{c.score}</span></span>
                                <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>Fit: <span className="font-bold" style={{ color: BRAND.accent }}>{c.fit}%</span></span>
                              </div>
                            </div>
                            <Badge className="border-0 text-[8px] px-1.5 py-0.5 text-white" style={{ backgroundColor: c.badge }}>{c.label}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold mb-2 uppercase tracking-wider" style={{ color: BRAND.primary }}>Hiring Pipeline</p>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { stage: 'Applied', count: 84, pct: 100 },
                          { stage: 'Assessed', count: 52, pct: 62 },
                          { stage: 'Shortlisted', count: 18, pct: 21 },
                          { stage: 'Offer', count: 4, pct: 5 },
                        ].map((s, i) => (
                          <div key={i} className="text-center p-2.5 rounded-lg border" data-testid={`hiring-pipeline-${i}`}>
                            <p className="text-base font-bold" style={{ color: BRAND.primary }}>{s.count}</p>
                            <p className="text-[9px] font-medium" style={{ color: 'var(--text-secondary)' }}>{s.stage}</p>
                            <div className="h-1 rounded-full mt-1.5" style={{ backgroundColor: `${BRAND.accent}15` }}>
                              <div className="h-full rounded-full" style={{ width: `${s.pct}%`, backgroundColor: BRAND.accent }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 p-2.5 rounded-lg border" style={{ borderColor: `${BRAND.accent}25` }} data-testid="hiring-dash-insight">
                      <Sparkles size={14} style={{ color: BRAND.accent }} />
                      <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                        <span className="font-semibold" style={{ color: BRAND.primary }}>AI Insight:</span> Arjun Patel's behavioral profile is a 92% match to your top-performer cohort. Recommend fast-tracking to final round.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-2 space-y-4">
                <Card className="border-0 shadow-md" data-testid="hiring-quick-actions">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}12` }}>
                        <Zap size={16} style={{ color: BRAND.accent }} />
                      </div>
                      <h3 className="font-bold text-sm" style={{ color: BRAND.primary }}>Quick Actions</h3>
                    </div>
                    <div className="space-y-2">
                      {[
                        'Create new role assessment',
                        'Invite candidates in bulk',
                        'View shortlisted profiles',
                        'Generate comparison report',
                        'Export to ATS / HRMS',
                      ].map((action, idx) => (
                        <div key={idx} className="flex items-center gap-2.5 p-2.5 rounded-lg border hover:shadow-sm transition-all cursor-pointer group" data-testid={`hiring-action-${idx}`}>
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

                <Card className="border-0 shadow-md" data-testid="hiring-domain-coverage">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}08` }}>
                        <PieChart size={16} style={{ color: BRAND.primary }} />
                      </div>
                      <h3 className="font-bold text-sm" style={{ color: BRAND.primary }}>Assessment Coverage</h3>
                    </div>
                    <div className="space-y-2.5">
                      {[
                        { label: 'Behavioral Domains', pct: 100, display: '19/19' },
                        { label: 'Competency Signals', pct: 97, display: '97' },
                        { label: 'Culture Fit Dimensions', pct: 85, display: '12/14' },
                      ].map((item, idx) => (
                        <div key={idx} data-testid={`hiring-coverage-${idx}`}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{item.label}</span>
                            <span className="font-bold" style={{ color: BRAND.accent }}>{item.display}</span>
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

        <section className="py-14 px-4" style={{ backgroundColor: 'var(--bg-secondary)' }} data-testid="hiring-use-cases-section">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }} data-testid="badge-hiring-use-cases">
                Hiring Scenarios
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }} data-testid="text-hiring-use-cases-title">
                For Every Hiring Scenario
              </h2>
              <p className="mt-2 text-sm max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }} data-testid="text-hiring-use-cases-desc">
                Tailored assessment solutions for graduate, lateral, and leadership hiring needs
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {USE_CASES.map((uc, idx) => (
                <Card key={idx} className="border-0 shadow-sm hover:shadow-md transition-all overflow-hidden group" data-testid={`hiring-use-case-${idx}`}>
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

        <section className="py-14 px-4" data-testid="hiring-testimonials-section">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }} data-testid="badge-hiring-testimonials">
                HR Leaders Say
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }} data-testid="text-hiring-testimonials-title">
                Trusted by Enterprise HR Teams
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
              {TESTIMONIALS.map((t, idx) => (
                <Card key={idx} className="border-0 shadow-sm hover:shadow-md transition-all" data-testid={`hiring-testimonial-${idx}`}>
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

        <section className="py-14 px-4" style={{ backgroundColor: 'var(--bg-secondary)' }} data-testid="hiring-how-it-works-section">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }} data-testid="badge-hiring-how">
                Simple Process
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }} data-testid="text-hiring-how-title">
                Get Started in 3 Steps
              </h2>
              <p className="mt-2 text-sm max-w-lg mx-auto" style={{ color: 'var(--text-secondary)' }} data-testid="text-hiring-how-desc">
                From role definition to confident hiring decisions
              </p>
            </div>

            <div className="relative">
              <div className="hidden md:block absolute top-14 left-[16%] right-[16%] h-px" style={{ backgroundColor: `${BRAND.accent}20` }} />
              <div className="grid md:grid-cols-3 gap-6">
                {HOW_IT_WORKS.map((step) => (
                  <div key={step.step} className="relative text-center" data-testid={`hiring-step-${step.step}`}>
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

        <section className="py-16 px-4" style={{ backgroundColor: BRAND.primary }} data-testid="hiring-cta-section">
          <div className="max-w-3xl mx-auto text-center">
            <div className="h-12 w-12 rounded-xl bg-white/12 flex items-center justify-center mx-auto mb-5">
              <Briefcase size={24} className="text-white" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 tracking-tight" data-testid="text-hiring-cta">
              Transform Your <span style={{ color: BRAND.accent }}>Hiring Process</span>
            </h2>
            <p className="text-white/65 text-sm mb-8 max-w-lg mx-auto leading-relaxed" data-testid="text-hiring-cta-desc">
              Join forward-thinking enterprises using MetryxOne to hire based on behavioral potential, not just resumes.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 mb-6">
              <Button
                className="h-10 px-8 font-medium text-sm rounded-lg text-white"
                style={{ backgroundColor: BRAND.accent }}
                onClick={() => onNavigate('request-demo')}
                data-testid="btn-hiring-cta-demo"
              >
                Request a Demo <ArrowRight size={15} className="ml-1.5" />
              </Button>
              <Button
                variant="outline"
                className="h-10 px-8 font-medium text-sm border-white/25 text-white hover:bg-white/10 rounded-lg"
                onClick={() => onNavigate('support')}
                data-testid="btn-hiring-cta-contact"
              >
                Contact Sales
              </Button>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-white/50 text-xs" data-testid="hiring-cta-trust">
              <span className="flex items-center gap-1.5" data-testid="cta-trust-enterprises"><Briefcase size={13} /> 50+ enterprises onboarded</span>
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
