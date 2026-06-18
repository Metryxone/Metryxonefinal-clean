import {
  Heart, Target, Users, Lightbulb, Award, Globe,
  ArrowRight, ArrowDown, CheckCircle, Brain, Shield, Sparkles,
  GraduationCap, TrendingUp, Zap, BookOpen, Star,
  Building2, ChevronRight, Play, Rocket, Eye
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Screen } from "../App";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const BRAND = {
  primary: "#344E86",
  accent: "#4ECDC4"
};

interface AboutPageProps {
  onNavigate: (screen: Screen) => void;
}

const IMPACT_STATS = [
  { value: '50K+', label: 'Students assessed', icon: Users },
  { value: '500+', label: 'Partner schools', icon: Building2 },
  { value: '19', label: 'Behavioral domains', icon: Brain },
  { value: '10+', label: 'Indian languages', icon: Globe },
];

const VALUES = [
  { icon: Heart, title: "Student-First", desc: "Every decision starts with what's best for the student's wellbeing and growth.", color: BRAND.accent },
  { icon: Shield, title: "Privacy & Trust", desc: "We handle sensitive data with the highest security standards and complete transparency.", color: BRAND.primary },
  { icon: Lightbulb, title: "Science-Backed", desc: "Our assessments are grounded in educational psychology and validated research.", color: '#f59e0b' },
  { icon: Target, title: "Actionable Insights", desc: "We don't just diagnose — we provide clear, practical recommendations.", color: BRAND.accent },
  { icon: Sparkles, title: "Continuous Innovation", desc: "We constantly improve our methods with AI and the latest research.", color: '#8b5cf6' },
  { icon: Users, title: "Inclusive Access", desc: "Education intelligence should be available to every child, regardless of background.", color: BRAND.primary },
];

const MILESTONES = [
  { year: '2022', title: 'The Idea', desc: 'Identified the gap between academic effort and outcomes in Indian education.' },
  { year: '2023', title: 'Research & Build', desc: 'Built the 19-domain LBI framework with educational psychologists and AI researchers.' },
  { year: '2024', title: 'First 10K', desc: 'Assessed 10,000 students across 100 partner schools. Launched ExamReadiness Index™.' },
  { year: '2025', title: '50K & Growing', desc: 'Crossed 50K assessments. Expanded to enterprise hiring and campus recruitment.' },
];

const PROBLEM_POINTS = [
  { icon: Brain, text: "Focus patterns", desc: "How students concentrate and process information" },
  { icon: Heart, text: "Emotional regulation", desc: "How they handle stress, pressure, and setbacks" },
  { icon: Sparkles, text: "Learning motivation", desc: "What drives them and what holds them back" },
  { icon: Target, text: "Exam readiness", desc: "Psychological preparedness beyond content knowledge" },
];

export function AboutPage({ onNavigate }: AboutPageProps) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--bg-primary)" }}>
      <Navbar onNavigate={onNavigate} currentScreen="about" />
      
      <main className="flex-1 pt-20">
        <section className="relative py-14 md:py-20 px-4 overflow-hidden" style={{ backgroundColor: BRAND.primary }} data-testid="about-hero-section">
          <div className="absolute inset-0 opacity-[0.05]">
            <div className="absolute top-12 left-[8%] w-48 h-48 rounded-full border border-white" />
            <div className="absolute bottom-12 right-[6%] w-72 h-72 rounded-full border border-white" />
            <div className="absolute top-[30%] right-[25%] w-32 h-32 rounded-full border border-white" />
          </div>

          <div className="max-w-6xl mx-auto relative">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="text-white">
                <div className="flex items-center gap-2 mb-5">
                  <Badge className="bg-white/15 text-white border-0 text-xs px-3 py-1.5 font-medium" data-testid="badge-about-story">
                    <Heart size={12} className="mr-1" /> Our Story
                  </Badge>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold mb-3 leading-tight tracking-tight" data-testid="text-about-title">
                  Transforming Education Through{" "}
                  <span style={{ color: BRAND.accent }}>Behavioral Intelligence</span>
                </h1>
                <p className="text-sm text-white/70 mb-6 leading-relaxed max-w-md" data-testid="text-about-desc">
                  MetryxOne was born from a simple yet powerful observation: traditional education measures what students know, but rarely understands how they learn.
                </p>
                <div className="flex flex-col sm:flex-row gap-2.5 mb-6">
                  <Button
                    className="text-white font-medium h-10 px-6 text-sm rounded-lg"
                    style={{ backgroundColor: BRAND.accent }}
                    onClick={() => onNavigate('request-demo')}
                    data-testid="btn-about-demo"
                  >
                    Request a Demo <ArrowRight size={15} className="ml-1.5" />
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/25 text-white hover:bg-white/10 h-10 px-6 text-sm font-medium rounded-lg"
                    onClick={() => onNavigate('careers')}
                    data-testid="btn-about-careers"
                  >
                    View Careers
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-xs text-white/70 font-medium" data-testid="about-trust-badges">
                  <span className="flex items-center gap-1.5"><CheckCircle size={13} style={{ color: BRAND.accent }} /> DPDP Act Compliant</span>
                  <span className="flex items-center gap-1.5"><Shield size={13} style={{ color: BRAND.accent }} /> Privacy-First</span>
                  <span className="flex items-center gap-1.5"><Award size={13} style={{ color: BRAND.accent }} /> Research-Validated</span>
                  <span className="flex items-center gap-1.5"><Globe size={13} style={{ color: BRAND.accent }} /> Pan-India Access</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Brain, value: '50K+', label: 'Students Assessed', sub: 'deep cognitive analysis' },
                    { icon: Building2, value: '500+', label: 'Partner Schools', sub: 'trusted institutions' },
                  ].map((stat, idx) => (
                    <Card key={idx} className="bg-white/10 border-0" data-testid={`about-hero-stat-${idx}`}>
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
                    { icon: Award, value: 'DPDP', label: 'Compliant', sub: 'privacy-first approach' },
                    { icon: Globe, value: '10+', label: 'Languages', sub: 'accessible nationwide' },
                  ].map((stat, idx) => (
                    <Card key={idx + 2} className="bg-white/10 border-0" data-testid={`about-hero-stat-${idx + 2}`}>
                      <CardContent className="p-4 text-center text-white">
                        <stat.icon size={22} className="mx-auto mb-2" style={{ color: BRAND.accent }} />
                        <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                        <p className="text-xs font-semibold text-white/85 mt-0.5">{stat.label}</p>
                        <p className="text-[10px] text-white/45 mt-0.5">{stat.sub}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Card className="bg-white/10 border-0" data-testid="about-mission-card">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 text-white">
                      <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.accent}25` }}>
                        <Rocket size={20} style={{ color: BRAND.accent }} />
                      </div>
                      <div>
                        <p className="text-xs font-bold">Mission: Education Intelligence for Every Child</p>
                        <p className="text-[10px] text-white/55">Scientific insights that help every student reach their true potential</p>
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

        <section className="py-10 px-4" data-testid="about-impact-strip">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {IMPACT_STATS.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: `${BRAND.primary}04` }} data-testid={`about-impact-${i}`}>
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

        <section className="py-14 px-4" style={{ backgroundColor: 'var(--bg-secondary)' }} data-testid="about-problem-section">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-5 gap-10 items-start">
              <div className="lg:col-span-2">
                <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }} data-testid="badge-about-problem">
                  The Challenge
                </Badge>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-3" style={{ color: BRAND.primary }} data-testid="text-about-problem-title">
                  The Problem We're Solving
                </h2>
                <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
                  Every year, millions of students in India work incredibly hard but don't see results that match their effort. Parents are confused, teachers are overwhelmed, and students feel misunderstood.
                </p>
                <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
                  The education system focuses on marks and rankings, but ignores the psychological factors that truly determine academic success:
                </p>
                <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
                  We founded MetryxOne to bridge this gap — to provide scientific, actionable insights that help every child reach their true potential.
                </p>
                <Button
                  className="font-medium px-6 h-9 rounded-lg text-white text-sm"
                  style={{ backgroundColor: BRAND.accent }}
                  onClick={() => onNavigate('lbi-product')}
                  data-testid="btn-about-learn-lbi"
                >
                  <Play size={14} className="mr-1.5" /> Learn About LBI
                </Button>
              </div>
              <div className="lg:col-span-3 space-y-3" data-testid="about-problem-factors">
                <div className="grid sm:grid-cols-2 gap-3">
                  {PROBLEM_POINTS.map((point, idx) => (
                    <Card key={idx} className="border-0 shadow-sm hover:shadow-md transition-all group" data-testid={`about-factor-${idx}`}>
                      <CardContent className="p-5">
                        <div className="flex items-start gap-3">
                          <div
                            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                            style={{ backgroundColor: `${idx % 2 === 0 ? BRAND.accent : BRAND.primary}10` }}
                          >
                            <point.icon size={20} style={{ color: idx % 2 === 0 ? BRAND.accent : BRAND.primary }} />
                          </div>
                          <div>
                            <p className="text-sm font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>{point.text}</p>
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{point.desc}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Card className="border-0 shadow-md overflow-hidden" data-testid="about-gap-insight">
                  <div className="h-1" style={{ backgroundColor: BRAND.accent }} />
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.accent}12` }}>
                        <Eye size={18} style={{ color: BRAND.accent }} />
                      </div>
                      <div>
                        <p className="text-sm font-bold" style={{ color: BRAND.primary }}>The Insight</p>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          Traditional education measures <span className="font-semibold" style={{ color: BRAND.primary }}>what</span> students know, but rarely understands <span className="font-semibold" style={{ color: BRAND.accent }}>how</span> they learn. That's the gap MetryxOne fills.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section className="py-14 px-4" data-testid="about-values-section">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }} data-testid="badge-about-values">
                What Drives Us
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }} data-testid="text-about-values-title">
                Our Core Values
              </h2>
              <p className="mt-2 text-sm max-w-lg mx-auto" style={{ color: 'var(--text-secondary)' }}>
                The principles that guide every decision we make
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {VALUES.map((value, i) => (
                <Card key={i} className="border-0 shadow-sm hover:shadow-md transition-all overflow-hidden group" data-testid={`about-value-${i}`}>
                  <div className="h-1" style={{ backgroundColor: value.color }} />
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div
                        className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                        style={{ backgroundColor: `${value.color}12` }}
                      >
                        <value.icon size={22} style={{ color: value.color }} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{value.title}</h3>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{value.desc}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-14 px-4" style={{ backgroundColor: 'var(--bg-secondary)' }} data-testid="about-timeline-section">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }} data-testid="badge-about-journey">
                Our Journey
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }} data-testid="text-about-journey-title">
                From Idea to Impact
              </h2>
            </div>

            <div className="relative">
              <div className="hidden md:block absolute top-14 left-[10%] right-[10%] h-px" style={{ backgroundColor: `${BRAND.accent}20` }} />
              <div className="grid md:grid-cols-4 gap-6">
                {MILESTONES.map((m, idx) => (
                  <div key={idx} className="relative text-center" data-testid={`about-milestone-${idx}`}>
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-xs relative z-10"
                      style={{ backgroundColor: idx === MILESTONES.length - 1 ? BRAND.accent : BRAND.primary }}
                    >
                      {m.year}
                    </div>
                    <Card className="border-0 shadow-sm hover:shadow-md transition-all">
                      <CardContent className="p-5 text-center">
                        <h4 className="text-sm font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>{m.title}</h4>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{m.desc}</p>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-14 px-4" data-testid="about-difference-section">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              <div>
                <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }} data-testid="badge-about-difference">
                  Why MetryxOne
                </Badge>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-3" style={{ color: BRAND.primary }} data-testid="text-about-difference-title">
                  More Than Just Another EdTech
                </h2>
                <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
                  We're not replacing teachers or textbooks. We're adding the missing layer — behavioral
                  intelligence — that makes the entire education ecosystem more effective, empathetic, and equitable.
                </p>
                <div className="space-y-3">
                  {[
                    'Scientific LBI framework with 19 domains and 97 subdomains',
                    'AI-adaptive assessments for ages 6-18',
                    'Privacy-first, DPDP Act compliant platform',
                    'Actionable insights, not just scores',
                    'Serving schools, parents, and enterprises',
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5" data-testid={`about-diff-${i}`}>
                      <CheckCircle size={15} className="shrink-0 mt-0.5" style={{ color: BRAND.accent }} />
                      <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Brain, value: '19', label: 'Behavioral Domains', desc: 'Comprehensive coverage' },
                  { icon: Sparkles, value: '97', label: 'Subdomains', desc: 'Granular profiling' },
                  { icon: Users, value: '3', label: 'Age Bands', desc: '6-10, 11-14, 15-18' },
                  { icon: TrendingUp, value: 'AI', label: 'Powered Engine', desc: 'Adaptive assessments' },
                ].map((item, idx) => (
                  <Card key={idx} className="border-0 shadow-sm hover:shadow-md transition-all text-center" data-testid={`about-metric-${idx}`}>
                    <CardContent className="p-5">
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: `${idx % 2 === 0 ? BRAND.primary : BRAND.accent}10` }}>
                        <item.icon size={20} style={{ color: idx % 2 === 0 ? BRAND.primary : BRAND.accent }} />
                      </div>
                      <p className="text-2xl font-bold" style={{ color: BRAND.primary }}>{item.value}</p>
                      <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{item.label}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{item.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 px-4" style={{ backgroundColor: BRAND.primary }} data-testid="about-cta-section">
          <div className="max-w-3xl mx-auto text-center">
            <div className="h-12 w-12 rounded-xl bg-white/12 flex items-center justify-center mx-auto mb-5">
              <Heart size={24} className="text-white" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 tracking-tight" data-testid="text-about-cta">
              Join Us in <span style={{ color: BRAND.accent }}>Transforming Education</span>
            </h2>
            <p className="text-white/65 text-sm mb-8 max-w-lg mx-auto leading-relaxed" data-testid="text-about-cta-desc">
              Whether you're a parent, school, or organization, we'd love to show you how MetryxOne can help unlock every student's potential.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 mb-6">
              <Button
                className="h-10 px-8 font-medium text-sm rounded-lg text-white"
                style={{ backgroundColor: BRAND.accent }}
                onClick={() => onNavigate('request-demo')}
                data-testid="btn-about-cta-demo"
              >
                Request a Demo <ArrowRight size={15} className="ml-1.5" />
              </Button>
              <Button
                variant="outline"
                className="h-10 px-8 font-medium text-sm border-white/25 text-white hover:bg-white/10 rounded-lg"
                onClick={() => onNavigate('careers')}
                data-testid="btn-about-cta-careers"
              >
                View Careers
              </Button>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-white/50 text-xs" data-testid="about-cta-trust">
              <span className="flex items-center gap-1.5"><GraduationCap size={13} /> 50K+ students impacted</span>
              <span className="flex items-center gap-1.5"><Shield size={13} /> DPDP compliant</span>
              <span className="flex items-center gap-1.5"><CheckCircle size={13} /> Research-validated</span>
            </div>
          </div>
        </section>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
