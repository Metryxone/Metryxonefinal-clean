import {
  Rocket, CheckCircle, Shield, ArrowRight, ArrowDown,
  BookOpen, Users, Brain, Award, Zap, BarChart3, Lock,
  TrendingUp, Sparkles, Layers, Code, Webhook,
  ClipboardCheck, Globe, FileText, Monitor, Key, Play,
  ChevronRight, CheckCircle2, Star, Terminal, Database
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
  { icon: Code, title: 'RESTful API Integration', desc: 'Production-ready REST APIs with comprehensive endpoints for assessments, reports, and user management. Full OpenAPI documentation included.' },
  { icon: Monitor, title: 'White-Label Report Embedding', desc: 'Embed branded assessment reports directly into your platform with customizable themes, logos, and color schemes.' },
  { icon: Webhook, title: 'Real-Time Webhooks', desc: 'Instant notifications for assessment completions, score updates, and report generation via configurable webhook endpoints.' },
  { icon: Users, title: 'Multi-Tenant Architecture', desc: 'Securely serve multiple organizations from a single integration. Full data isolation, tenant configs, and role-based access.' },
  { icon: Sparkles, title: 'Custom Branding Support', desc: 'Complete white-labeling — custom domains, branded emails, personalized report headers, and platform-native look and feel.' },
  { icon: FileText, title: 'Developer Documentation', desc: 'Comprehensive API reference, SDKs for popular frameworks, code samples, Postman collections, and developer support.' },
];

const USE_CASES = [
  {
    icon: BookOpen, title: 'LMS Integration', color: BRAND.accent,
    items: ['Embed LBI assessments into your LMS', 'Auto-enroll students and sync grades', 'Surface behavioral insights alongside content', 'Seamless single sign-on support'],
  },
  {
    icon: Brain, title: 'Assessment Platform', color: BRAND.primary,
    items: ['Add behavioral intelligence to psychometrics', '19-domain LBI coverage integration', 'AI-powered report generation API', 'Custom scoring and benchmarking'],
  },
  {
    icon: BarChart3, title: 'Student Analytics', color: '#8b5cf6',
    items: ['Enrich dashboards with behavioral data', 'Track learning patterns and readiness', 'Cohort and individual-level insights', 'Export and visualization API endpoints'],
  },
];

const HOW_IT_WORKS = [
  { step: 1, title: 'Get API Key', desc: 'Register your platform, configure tenant settings, and receive API credentials. Full sandbox environment for testing.', icon: Key },
  { step: 2, title: 'Integrate SDK', desc: 'Use lightweight SDKs for React, Angular, or vanilla JS. Drop-in components for assessments, reports, and dashboards.', icon: Code },
  { step: 3, title: 'Launch', desc: 'Go live with production keys. Monitor usage via developer dashboard, scale automatically, and access technical support.', icon: Play },
];

export function EdTechPage({ onNavigate }: Props) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Navbar onNavigate={onNavigate} currentScreen="edtech" />

      <main className="flex-1 pt-20">
        <section className="relative py-14 md:py-20 px-4 overflow-hidden" style={{ backgroundColor: BRAND.primary }} data-testid="edtech-hero-section">
          <div className="absolute inset-0 opacity-[0.05]">
            <div className="absolute top-12 left-[8%] w-48 h-48 rounded-full border border-white" />
            <div className="absolute bottom-12 right-[6%] w-72 h-72 rounded-full border border-white" />
            <div className="absolute top-[30%] right-[25%] w-32 h-32 rounded-full border border-white" />
          </div>

          <div className="max-w-6xl mx-auto relative">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="text-white">
                <div className="flex items-center gap-2 mb-5">
                  <Badge className="bg-white/15 text-white border-0 text-xs px-3 py-1.5 font-medium" data-testid="badge-edtech-solution">
                    <Rocket size={12} className="mr-1" /> Solution
                  </Badge>
                  <Badge className="border-0 text-xs px-3 py-1.5 font-semibold" style={{ backgroundColor: `${BRAND.accent}30`, color: BRAND.accent }} data-testid="badge-edtech-api">
                    API-FIRST
                  </Badge>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold mb-3 leading-tight tracking-tight" data-testid="text-edtech-title">
                  EdTech Platforms
                </h1>
                <p className="text-base font-medium mb-2 text-white/90 leading-relaxed" data-testid="text-edtech-subtitle">
                  API Integration for Seamless Learning Platform Embedding
                </p>
                <p className="text-sm text-white/65 mb-6 leading-relaxed max-w-md" data-testid="text-edtech-desc">
                  Embed comprehensive behavioral intelligence directly into your EdTech platform.
                  Production-ready APIs, white-label reports, and real-time webhooks — everything
                  you need to enhance your learning experience.
                </p>
                <div className="flex flex-col sm:flex-row gap-2.5 mb-6">
                  <Button
                    className="text-white font-medium h-10 px-6 text-sm rounded-lg"
                    style={{ backgroundColor: BRAND.accent }}
                    onClick={() => onNavigate('request-demo')}
                    data-testid="btn-edtech-get-started"
                  >
                    Get API Access <ArrowRight size={15} className="ml-1.5" />
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/25 text-white hover:bg-white/10 h-10 px-6 text-sm font-medium rounded-lg"
                    onClick={() => onNavigate('lbi-product')}
                    data-testid="btn-edtech-learn-more"
                  >
                    View Documentation
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-xs text-white/70 font-medium" data-testid="edtech-trust-badges">
                  <span className="flex items-center gap-1.5" data-testid="trust-soc2">
                    <CheckCircle size={13} style={{ color: BRAND.accent }} /> SOC2 Certified
                  </span>
                  <span className="flex items-center gap-1.5" data-testid="trust-gdpr">
                    <Shield size={13} style={{ color: BRAND.accent }} /> GDPR Ready
                  </span>
                  <span className="flex items-center gap-1.5" data-testid="trust-dpdp">
                    <CheckCircle size={13} style={{ color: BRAND.accent }} /> DPDP Compliant
                  </span>
                  <span className="flex items-center gap-1.5" data-testid="trust-sla">
                    <Zap size={13} style={{ color: BRAND.accent }} /> Enterprise SLA
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Code, value: 'REST API', label: 'Integration Type', sub: 'full OpenAPI spec' },
                    { icon: Layers, value: '19', label: 'LBI Domains', sub: '97 subdomains' },
                  ].map((stat, idx) => (
                    <Card key={idx} className="bg-white/10 border-0" data-testid={`edtech-stat-card-${idx}`}>
                      <CardContent className="p-4 text-center text-white">
                        <stat.icon size={22} className="mx-auto mb-2" style={{ color: BRAND.accent }} />
                        <p className="text-lg font-bold tracking-tight">{stat.value}</p>
                        <p className="text-xs font-semibold text-white/85 mt-0.5">{stat.label}</p>
                        <p className="text-[10px] text-white/45 mt-0.5">{stat.sub}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Zap, value: '<100ms', label: 'API Latency', sub: 'p95 response time' },
                    { icon: Shield, value: '99.9%', label: 'Uptime SLA', sub: 'enterprise guarantee' },
                  ].map((stat, idx) => (
                    <Card key={idx + 2} className="bg-white/10 border-0" data-testid={`edtech-stat-card-${idx + 2}`}>
                      <CardContent className="p-4 text-center text-white">
                        <stat.icon size={22} className="mx-auto mb-2" style={{ color: BRAND.accent }} />
                        <p className="text-lg font-bold tracking-tight">{stat.value}</p>
                        <p className="text-xs font-semibold text-white/85 mt-0.5">{stat.label}</p>
                        <p className="text-[10px] text-white/45 mt-0.5">{stat.sub}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Card className="bg-white/10 border-0" data-testid="edtech-compliance-card">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 text-white">
                      <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.accent}25` }}>
                        <Award size={20} style={{ color: BRAND.accent }} />
                      </div>
                      <div>
                        <p className="text-xs font-bold">Enterprise-Grade API Platform</p>
                        <p className="text-[10px] text-white/55">SOC2, GDPR & DPDP compliant with 99.9% uptime SLA</p>
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

        <section className="py-10 px-4" data-testid="edtech-value-strip">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Code, label: 'Plug-and-Play API', text: 'Production-ready REST APIs with SDKs for React, Angular & vanilla JS' },
                { icon: Monitor, label: 'White-Label Reports', text: 'Fully branded assessment reports embedded natively in your platform' },
                { icon: Webhook, label: 'Real-Time Webhooks', text: 'Instant event notifications for assessments, scores, and reports' },
                { icon: Users, label: 'Multi-Tenant', text: 'Secure multi-organization support with full data isolation' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: `${BRAND.primary}04` }} data-testid={`edtech-value-item-${i}`}>
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

        <section className="py-14 px-4" style={{ backgroundColor: 'var(--bg-secondary)' }} data-testid="edtech-features-section">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-5 gap-10 items-start">
              <div className="lg:col-span-2">
                <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.accent}20`, color: BRAND.accent }} data-testid="badge-edtech-features">
                  Platform Features
                </Badge>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-3" style={{ color: BRAND.primary }} data-testid="text-edtech-features-title">
                  Built for EdTech Integration
                </h2>
                <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }} data-testid="text-edtech-features-desc">
                  Everything you need to embed behavioral intelligence into your learning platform —
                  from assessment APIs to white-label report components.
                </p>
                <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
                  Built with developer experience in mind. Comprehensive docs, SDKs,
                  sandbox environments, and dedicated technical support.
                </p>
                <Button
                  className="font-medium px-6 h-9 rounded-lg text-white text-sm"
                  style={{ backgroundColor: BRAND.accent }}
                  onClick={() => onNavigate('request-demo')}
                  data-testid="btn-edtech-features-demo"
                >
                  <Play size={14} className="mr-1.5" /> View API Docs
                </Button>
              </div>
              <div className="lg:col-span-3 grid sm:grid-cols-2 gap-4" data-testid="edtech-features-grid">
                {FEATURES.map((feature, idx) => (
                  <Card key={idx} className="border-0 shadow-sm hover:shadow-md transition-all group" data-testid={`edtech-feature-card-${idx}`}>
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

        <section className="py-14 px-4" data-testid="edtech-api-preview-section">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-8">
              <div>
                <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }} data-testid="badge-edtech-preview">
                  API Preview
                </Badge>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }} data-testid="text-edtech-preview-title">
                  Developer-Friendly Integration
                </h2>
                <p className="mt-1.5 text-sm max-w-xl" style={{ color: 'var(--text-secondary)' }} data-testid="text-edtech-preview-desc">
                  Clean REST APIs, real-time webhooks, and drop-in SDK components
                </p>
              </div>
              <Button
                variant="outline"
                className="font-medium px-5 h-9 rounded-lg shrink-0 text-sm"
                style={{ borderColor: BRAND.primary, color: BRAND.primary }}
                onClick={() => onNavigate('request-demo')}
                data-testid="btn-edtech-preview-demo"
              >
                <Terminal size={13} className="mr-1.5" /> Try Sandbox
              </Button>
            </div>

            <div className="grid lg:grid-cols-5 gap-5">
              <div className="lg:col-span-3">
                <Card className="border-0 shadow-md h-full overflow-hidden" data-testid="edtech-api-mockup">
                  <div className="px-4 py-2.5 flex items-center justify-between border-b" style={{ backgroundColor: BRAND.primary }}>
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}30` }}>
                        <Terminal size={14} style={{ color: BRAND.accent }} />
                      </div>
                      <div className="text-white">
                        <p className="text-xs font-bold">API Console</p>
                        <p className="text-[9px] text-white/55">MetryxOne REST API v2.0</p>
                      </div>
                    </div>
                    <Badge className="bg-white/15 text-white border-0 text-[9px] px-2 py-0.5" data-testid="badge-edtech-api-live">Sandbox</Badge>
                  </div>
                  <CardContent className="p-4 space-y-4" style={{ backgroundColor: '#fafbfc' }}>
                    <div>
                      <p className="text-[10px] font-bold mb-2 uppercase tracking-wider" style={{ color: BRAND.primary }}>Available Endpoints</p>
                      <div className="space-y-1.5">
                        {[
                          { method: 'POST', path: '/api/v2/assessments/start', label: 'Start LBI Assessment' },
                          { method: 'GET', path: '/api/v2/reports/{id}', label: 'Get Assessment Report' },
                          { method: 'GET', path: '/api/v2/students/{id}/scores', label: 'Student Domain Scores' },
                          { method: 'POST', path: '/api/v2/webhooks/register', label: 'Register Webhook' },
                          { method: 'GET', path: '/api/v2/cohorts/{id}/analytics', label: 'Cohort Analytics' },
                        ].map((ep, i) => (
                          <div key={i} className="flex items-center gap-2 p-2 rounded-lg border" data-testid={`api-endpoint-${i}`}>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{
                              backgroundColor: ep.method === 'POST' ? `${BRAND.accent}15` : `${BRAND.primary}10`,
                              color: ep.method === 'POST' ? BRAND.accent : BRAND.primary,
                            }}>{ep.method}</span>
                            <code className="text-[10px] font-mono flex-1" style={{ color: 'var(--text-primary)' }}>{ep.path}</code>
                            <span className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>{ep.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold mb-2 uppercase tracking-wider" style={{ color: BRAND.primary }}>Sample Response</p>
                      <div className="p-3 rounded-lg border font-mono text-[10px] leading-relaxed" style={{ backgroundColor: `${BRAND.primary}04`, color: 'var(--text-primary)' }} data-testid="api-sample-response">
                        <span style={{ color: 'var(--text-secondary)' }}>{'{'}</span><br />
                        &nbsp;&nbsp;<span style={{ color: BRAND.primary }}>"student_id"</span>: <span style={{ color: BRAND.accent }}>"STU_2847"</span>,<br />
                        &nbsp;&nbsp;<span style={{ color: BRAND.primary }}>"lbi_score"</span>: <span style={{ color: BRAND.accent }}>72.4</span>,<br />
                        &nbsp;&nbsp;<span style={{ color: BRAND.primary }}>"domains"</span>: <span style={{ color: 'var(--text-secondary)' }}>{'['} 19 items {']'}</span>,<br />
                        &nbsp;&nbsp;<span style={{ color: BRAND.primary }}>"exam_readiness"</span>: <span style={{ color: BRAND.accent }}>74.8</span><br />
                        <span style={{ color: 'var(--text-secondary)' }}>{'}'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-2 space-y-4">
                <Card className="border-0 shadow-md" data-testid="edtech-sdk-support">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}12` }}>
                        <Code size={16} style={{ color: BRAND.accent }} />
                      </div>
                      <h3 className="font-bold text-sm" style={{ color: BRAND.primary }}>SDK Support</h3>
                    </div>
                    <div className="space-y-2">
                      {[
                        'React SDK (npm install @metryx/react)',
                        'Angular SDK (@metryx/angular)',
                        'Vanilla JS (CDN or npm)',
                        'Python SDK (pip install metryx)',
                        'Node.js SDK (npm install metryx)',
                      ].map((sdk, idx) => (
                        <div key={idx} className="flex items-center gap-2.5 p-2.5 rounded-lg border hover:shadow-sm transition-all cursor-pointer group" data-testid={`sdk-item-${idx}`}>
                          <div className="h-6 w-6 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.primary}06` }}>
                            <ChevronRight size={12} style={{ color: BRAND.primary }} />
                          </div>
                          <span className="text-xs font-medium flex-1 font-mono" style={{ color: 'var(--text-primary)' }}>{sdk}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-md" data-testid="edtech-api-stats">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}08` }}>
                        <Database size={16} style={{ color: BRAND.primary }} />
                      </div>
                      <h3 className="font-bold text-sm" style={{ color: BRAND.primary }}>API Performance</h3>
                    </div>
                    <div className="space-y-2.5">
                      {[
                        { label: 'Uptime (30d)', pct: 99.9 },
                        { label: 'Avg Response', pct: 95, display: '< 100ms' },
                        { label: 'Success Rate', pct: 99.7 },
                      ].map((item, idx) => (
                        <div key={idx} data-testid={`api-perf-${idx}`}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{item.label}</span>
                            <span className="font-bold" style={{ color: BRAND.accent }}>{item.display || `${item.pct}%`}</span>
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

        <section className="py-14 px-4" style={{ backgroundColor: 'var(--bg-secondary)' }} data-testid="edtech-use-cases-section">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }} data-testid="badge-edtech-use-cases">
                Integration Use Cases
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }} data-testid="text-edtech-use-cases-title">
                Powering Every Learning Platform
              </h2>
              <p className="mt-2 text-sm max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }} data-testid="text-edtech-use-cases-desc">
                Flexible integration patterns for different EdTech platform architectures
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {USE_CASES.map((uc, idx) => (
                <Card key={idx} className="border-0 shadow-sm hover:shadow-md transition-all overflow-hidden group" data-testid={`edtech-use-case-${idx}`}>
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

        <section className="py-14 px-4" data-testid="edtech-how-it-works-section">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }} data-testid="badge-edtech-how">
                Quick Integration
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }} data-testid="text-edtech-how-title">
                Get Started in 3 Steps
              </h2>
              <p className="mt-2 text-sm max-w-lg mx-auto" style={{ color: 'var(--text-secondary)' }} data-testid="text-edtech-how-desc">
                From API key to production launch in minutes, not months
              </p>
            </div>

            <div className="relative">
              <div className="hidden md:block absolute top-14 left-[16%] right-[16%] h-px" style={{ backgroundColor: `${BRAND.accent}20` }} />
              <div className="grid md:grid-cols-3 gap-6">
                {HOW_IT_WORKS.map((step) => (
                  <div key={step.step} className="relative text-center" data-testid={`edtech-step-${step.step}`}>
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

        <section className="py-16 px-4" style={{ backgroundColor: BRAND.primary }} data-testid="edtech-cta-section">
          <div className="max-w-3xl mx-auto text-center">
            <div className="h-12 w-12 rounded-xl bg-white/12 flex items-center justify-center mx-auto mb-5">
              <Code size={24} className="text-white" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 tracking-tight" data-testid="text-edtech-cta">
              Ready to Integrate <span style={{ color: BRAND.accent }}>MetryxOne</span>
            </h2>
            <p className="text-white/65 text-sm mb-8 max-w-lg mx-auto leading-relaxed" data-testid="text-edtech-cta-desc">
              Get API access today and start embedding behavioral intelligence into your
              EdTech platform in minutes. Full sandbox environment included.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 mb-6">
              <Button
                className="h-10 px-8 font-medium text-sm rounded-lg text-white"
                style={{ backgroundColor: BRAND.accent }}
                onClick={() => onNavigate('request-demo')}
                data-testid="btn-edtech-cta-demo"
              >
                Get API Access <ArrowRight size={15} className="ml-1.5" />
              </Button>
              <Button
                variant="outline"
                className="h-10 px-8 font-medium text-sm border-white/25 text-white hover:bg-white/10 rounded-lg"
                onClick={() => onNavigate('support')}
                data-testid="btn-edtech-cta-contact"
              >
                Contact Sales
              </Button>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-white/50 text-xs" data-testid="edtech-cta-trust">
              <span className="flex items-center gap-1.5" data-testid="cta-trust-sandbox"><Terminal size={13} /> Free sandbox access</span>
              <span className="flex items-center gap-1.5" data-testid="cta-trust-sla"><Shield size={13} /> 99.9% uptime SLA</span>
              <span className="flex items-center gap-1.5" data-testid="cta-trust-support"><CheckCircle size={13} /> Developer support</span>
            </div>
          </div>
        </section>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
