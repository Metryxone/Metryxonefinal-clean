import {
  BarChart3, CheckCircle, Shield, ArrowRight, ArrowDown,
  Users, Brain, Award, Zap, TrendingUp,
  Target, Heart, Settings, Activity,
  ClipboardCheck, CheckCircle2, Star, Play,
  Layers, PieChart, Briefcase, AlertTriangle
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
  { icon: Users, title: 'Team Dynamics Mapping', desc: 'Visualize collaboration patterns, communication flows, and interpersonal dynamics across teams to identify high-performing configurations.' },
  { icon: TrendingUp, title: 'Leadership Pipeline Analytics', desc: 'Identify and track leadership readiness across your organization. Predict future leaders with behavioral and competency data.' },
  { icon: Brain, title: 'Skill Gap Intelligence', desc: 'Detect skill gaps at individual, team, and department levels. Get AI-powered recommendations for upskilling and hiring priorities.' },
  { icon: BarChart3, title: 'Department Benchmarking', desc: 'Compare performance metrics across departments and teams. Identify best practices and replicate success patterns organization-wide.' },
  { icon: AlertTriangle, title: 'Retention Risk Signals', desc: 'Early warning system for attrition risk. Behavioral signals and engagement patterns predict flight risk before it happens.' },
  { icon: Heart, title: 'DEI Analytics', desc: 'Track diversity, equity, and inclusion metrics across hiring, promotions, and team composition with bias-free AI analytics.' },
];

const USE_CASES = [
  {
    icon: Target, title: 'Performance Optimization', color: BRAND.accent,
    items: ['Identify top-performer behavioral patterns', 'Replicate success across underperforming teams', 'Data-driven coaching recommendations', 'Real-time performance trend monitoring'],
  },
  {
    icon: Award, title: 'Succession Planning', color: BRAND.primary,
    items: ['Map leadership readiness across levels', 'Behavioral competency gap analysis', 'High-potential identification and tracking', 'Succession risk scoring by role'],
  },
  {
    icon: Layers, title: 'Workforce Planning', color: '#8b5cf6',
    items: ['Predict future skill requirements', 'Optimize team composition and sizing', 'Hiring vs. upskilling cost analysis', 'Strategic workforce allocation models'],
  },
];

const HOW_IT_WORKS = [
  { step: 1, title: 'Connect Your Data', desc: 'Integrate with your HRIS, performance management, and survey tools. Secure data sync with enterprise-grade encryption.', icon: Settings },
  { step: 2, title: 'Analyze Patterns', desc: 'AI analyzes team dynamics, skill distributions, and performance trends. Get actionable insights in real-time dashboards.', icon: PieChart },
  { step: 3, title: 'Act on Insights', desc: 'Implement data-driven decisions for team optimization, succession planning, and strategic workforce development.', icon: Activity },
];

const IMPACT_STATS = [
  { value: '500+', label: 'Teams Analyzed', icon: Users },
  { value: '85%', label: 'Prediction Accuracy', icon: Target },
  { value: '30%', label: 'Faster Decisions', icon: Zap },
  { value: '40%', label: 'Reduced Attrition Risk', icon: Heart },
];

export function WorkforceAnalyticsPage({ onNavigate }: Props) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Navbar onNavigate={onNavigate} currentScreen="enterprise-hiring" />

      <main className="flex-1 pt-20">
        <section className="relative py-14 md:py-20 px-4 overflow-hidden" style={{ backgroundColor: BRAND.primary }} data-testid="workforce-hero-section">
          <div className="absolute inset-0 opacity-[0.05]">
            <div className="absolute top-12 left-[8%] w-48 h-48 rounded-full border border-white" />
            <div className="absolute bottom-12 right-[6%] w-72 h-72 rounded-full border border-white" />
            <div className="absolute top-[30%] right-[25%] w-32 h-32 rounded-full border border-white" />
          </div>

          <div className="max-w-6xl mx-auto relative">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="text-white">
                <div className="flex items-center gap-2 mb-5">
                  <Badge className="bg-white/15 text-white border-0 text-xs px-3 py-1.5 font-medium" data-testid="badge-workforce-solution">
                    <BarChart3 size={12} className="mr-1" /> Solution
                  </Badge>
                  <Badge className="border-0 text-xs px-3 py-1.5 font-semibold" style={{ backgroundColor: `${BRAND.accent}30`, color: BRAND.accent }} data-testid="badge-workforce-enterprise">
                    ENTERPRISE
                  </Badge>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold mb-3 leading-tight tracking-tight" data-testid="text-workforce-title">
                  Workforce Analytics
                </h1>
                <p className="text-base font-medium mb-2 text-white/90 leading-relaxed" data-testid="text-workforce-subtitle">
                  Team Performance Patterns & Leadership Readiness
                </p>
                <p className="text-sm text-white/65 mb-6 leading-relaxed max-w-md" data-testid="text-workforce-desc">
                  Uncover hidden performance patterns, identify leadership potential, and close skill gaps
                  with AI-powered workforce analytics. Make data-driven decisions that transform team
                  effectiveness across your organization.
                </p>
                <div className="flex flex-col sm:flex-row gap-2.5 mb-6">
                  <Button
                    className="text-white font-medium h-10 px-6 text-sm rounded-lg"
                    style={{ backgroundColor: BRAND.accent }}
                    onClick={() => onNavigate('request-demo')}
                    data-testid="btn-workforce-get-started"
                  >
                    Get Started <ArrowRight size={15} className="ml-1.5" />
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/25 text-white hover:bg-white/10 h-10 px-6 text-sm font-medium rounded-lg"
                    onClick={() => onNavigate('lbi-product')}
                    data-testid="btn-workforce-learn-more"
                  >
                    Learn About LBI
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-xs text-white/70 font-medium" data-testid="workforce-trust-badges">
                  <span className="flex items-center gap-1.5" data-testid="trust-workforce-ai">
                    <CheckCircle size={13} style={{ color: BRAND.accent }} /> AI-Powered Insights
                  </span>
                  <span className="flex items-center gap-1.5" data-testid="trust-workforce-compliant">
                    <Shield size={13} style={{ color: BRAND.accent }} /> DPDP Compliant
                  </span>
                  <span className="flex items-center gap-1.5" data-testid="trust-workforce-realtime">
                    <CheckCircle size={13} style={{ color: BRAND.accent }} /> Real-Time Dashboards
                  </span>
                  <span className="flex items-center gap-1.5" data-testid="trust-workforce-enterprise">
                    <Zap size={13} style={{ color: BRAND.accent }} /> Enterprise Scale
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Users, value: '500+', label: 'Teams Analyzed', sub: 'across enterprises' },
                    { icon: Target, value: '85%', label: 'Prediction Accuracy', sub: 'leadership readiness' },
                  ].map((stat, idx) => (
                    <Card key={idx} className="bg-white/10 border-0" data-testid={`workforce-stat-card-${idx}`}>
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
                    { icon: Zap, value: '30%', label: 'Faster Decisions', sub: 'data-driven insights' },
                    { icon: Brain, value: '19', label: 'Behavioral Domains', sub: 'comprehensive profiling' },
                  ].map((stat, idx) => (
                    <Card key={idx + 2} className="bg-white/10 border-0" data-testid={`workforce-stat-card-${idx + 2}`}>
                      <CardContent className="p-4 text-center text-white">
                        <stat.icon size={22} className="mx-auto mb-2" style={{ color: BRAND.accent }} />
                        <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                        <p className="text-xs font-semibold text-white/85 mt-0.5">{stat.label}</p>
                        <p className="text-[10px] text-white/45 mt-0.5">{stat.sub}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Card className="bg-white/10 border-0" data-testid="workforce-compliance-card">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 text-white">
                      <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.accent}25` }}>
                        <Award size={20} style={{ color: BRAND.accent }} />
                      </div>
                      <div>
                        <p className="text-xs font-bold">Enterprise-Grade Analytics</p>
                        <p className="text-[10px] text-white/55">SOC 2 compliant with role-based access controls</p>
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

        <section className="py-10 px-4" data-testid="workforce-impact-strip">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {IMPACT_STATS.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: `${BRAND.primary}04` }} data-testid={`workforce-impact-${i}`}>
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

        <section className="py-14 px-4" style={{ backgroundColor: 'var(--bg-secondary)' }} data-testid="workforce-features-section">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-5 gap-10 items-start">
              <div className="lg:col-span-2">
                <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.accent}20`, color: BRAND.accent }} data-testid="badge-workforce-features">
                  Platform Features
                </Badge>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-3" style={{ color: BRAND.primary }} data-testid="text-workforce-features-title">
                  See Your Workforce Clearly
                </h2>
                <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }} data-testid="text-workforce-features-desc">
                  Comprehensive analytics tools built for modern workforce management —
                  from team dynamics to strategic planning.
                </p>
                <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
                  Every feature is designed to surface actionable insights that drive
                  team performance, reduce attrition, and build future-ready leadership.
                </p>
                <Button
                  className="font-medium px-6 h-9 rounded-lg text-white text-sm"
                  style={{ backgroundColor: BRAND.accent }}
                  onClick={() => onNavigate('request-demo')}
                  data-testid="btn-workforce-features-demo"
                >
                  <Play size={14} className="mr-1.5" /> See It in Action
                </Button>
              </div>
              <div className="lg:col-span-3 grid sm:grid-cols-2 gap-4" data-testid="workforce-features-grid">
                {FEATURES.map((feature, idx) => (
                  <Card key={idx} className="border-0 shadow-sm hover:shadow-md transition-all group" data-testid={`workforce-feature-card-${idx}`}>
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

        <section className="py-14 px-4" style={{ backgroundColor: 'var(--bg-secondary)' }} data-testid="workforce-use-cases-section">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }} data-testid="badge-workforce-use-cases">
                Use Cases
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }} data-testid="text-workforce-use-cases-title">
                Analytics for Every Workforce Challenge
              </h2>
              <p className="mt-2 text-sm max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }} data-testid="text-workforce-use-cases-desc">
                From performance optimization to succession planning — data-driven workforce decisions
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {USE_CASES.map((uc, idx) => (
                <Card key={idx} className="border-0 shadow-sm hover:shadow-md transition-all overflow-hidden group" data-testid={`workforce-use-case-${idx}`}>
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

        <section className="py-14 px-4" data-testid="workforce-how-it-works-section">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }} data-testid="badge-workforce-how">
                Simple Process
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }} data-testid="text-workforce-how-title">
                Get Started in 3 Steps
              </h2>
              <p className="mt-2 text-sm max-w-lg mx-auto" style={{ color: 'var(--text-secondary)' }} data-testid="text-workforce-how-desc">
                From data integration to actionable workforce insights
              </p>
            </div>

            <div className="relative">
              <div className="hidden md:block absolute top-14 left-[16%] right-[16%] h-px" style={{ backgroundColor: `${BRAND.accent}20` }} />
              <div className="grid md:grid-cols-3 gap-6">
                {HOW_IT_WORKS.map((step) => (
                  <div key={step.step} className="relative text-center" data-testid={`workforce-step-${step.step}`}>
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

        <section className="py-16 px-4" style={{ backgroundColor: BRAND.primary }} data-testid="workforce-cta-section">
          <div className="max-w-3xl mx-auto text-center">
            <div className="h-12 w-12 rounded-xl bg-white/12 flex items-center justify-center mx-auto mb-5">
              <BarChart3 size={24} className="text-white" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 tracking-tight" data-testid="text-workforce-cta">
              Transform Your <span style={{ color: BRAND.accent }}>Workforce Strategy</span>
            </h2>
            <p className="text-white/65 text-sm mb-8 max-w-lg mx-auto leading-relaxed" data-testid="text-workforce-cta-desc">
              Join forward-thinking enterprises using MetryxOne to unlock team performance patterns and build future-ready leadership pipelines.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 mb-6">
              <Button
                className="h-10 px-8 font-medium text-sm rounded-lg text-white"
                style={{ backgroundColor: BRAND.accent }}
                onClick={() => onNavigate('request-demo')}
                data-testid="btn-workforce-cta-demo"
              >
                Request a Demo <ArrowRight size={15} className="ml-1.5" />
              </Button>
              <Button
                variant="outline"
                className="h-10 px-8 font-medium text-sm border-white/25 text-white hover:bg-white/10 rounded-lg"
                onClick={() => onNavigate('support')}
                data-testid="btn-workforce-cta-contact"
              >
                Contact Sales
              </Button>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-white/50 text-xs" data-testid="workforce-cta-trust">
              <span className="flex items-center gap-1.5" data-testid="cta-trust-teams"><Users size={13} /> 500+ teams analyzed</span>
              <span className="flex items-center gap-1.5" data-testid="cta-trust-accuracy"><Target size={13} /> 85% prediction accuracy</span>
              <span className="flex items-center gap-1.5" data-testid="cta-trust-free"><CheckCircle size={13} /> Free pilot program</span>
            </div>
          </div>
        </section>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
