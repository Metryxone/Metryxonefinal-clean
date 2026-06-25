import { BRAND } from '@/design-system/tokens';
import {
  Plug, CheckCircle, Shield, ArrowRight, ArrowDown,
  Users, Award, Zap,
  Target, Settings, Activity, Link,
  CheckCircle2, Play,
  Layers, Lock, Globe, Webhook, Server, FileCheck
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
  { icon: Layers, title: 'LMS Integration', desc: 'Native connectors for Cornerstone, SAP SuccessFactors, and 20+ learning management systems. Bi-directional sync of learner data and completions.' },
  { icon: Users, title: 'HRIS Sync', desc: 'Seamless integration with Workday, BambooHR, and major HRIS platforms. Auto-sync employee profiles, org structures, and role data.' },
  { icon: Server, title: 'API-First Architecture', desc: 'RESTful APIs with comprehensive documentation. Build custom integrations, automate workflows, and extend MetryxOne into any enterprise system.' },
  { icon: Lock, title: 'SSO & SCIM', desc: 'Enterprise single sign-on via SAML 2.0, OAuth 2.0, and OpenID Connect. SCIM provisioning for automated user lifecycle management.' },
  { icon: FileCheck, title: 'Compliance Reporting', desc: 'Automated compliance reports for SOC 2, GDPR, and DPDP. Audit trails, data lineage, and regulatory-ready documentation.' },
  { icon: Webhook, title: 'Custom Webhooks', desc: 'Real-time event notifications for assessment completions, report generation, and user actions. Build event-driven automation workflows.' },
];

const USE_CASES = [
  {
    icon: Globe, title: 'Enterprise Deployment', color: BRAND.accent,
    items: ['Unified SSO across all enterprise systems', 'Automated user provisioning via SCIM', 'Custom branding and white-label options', 'Multi-tenant architecture support'],
  },
  {
    icon: Link, title: 'Multi-Platform Sync', color: BRAND.primary,
    items: ['Bi-directional LMS data synchronization', 'HRIS employee profile auto-sync', 'Assessment results pushed to ATS', 'Learning completions tracked across platforms'],
  },
  {
    icon: Shield, title: 'Compliance Automation', color: '#8b5cf6',
    items: ['Automated SOC 2 and GDPR reporting', 'Data retention policy enforcement', 'Audit trail and access logging', 'Regulatory-ready export formats'],
  },
];

const HOW_IT_WORKS = [
  { step: 1, title: 'Connect Your Systems', desc: 'Use pre-built connectors or APIs to link MetryxOne with your LMS, HRIS, and enterprise systems. Configure SSO and user provisioning.', icon: Plug },
  { step: 2, title: 'Configure Data Flows', desc: 'Set up bi-directional data sync rules. Define what data flows where, set schedules, and configure webhooks for real-time events.', icon: Settings },
  { step: 3, title: 'Go Live with Confidence', desc: 'Enterprise-grade monitoring, 99.9% uptime SLA, and dedicated integration support ensure seamless operations from day one.', icon: Activity },
];

const IMPACT_STATS = [
  { value: '50+', label: 'Integrations Available', icon: Plug },
  { value: '99.9%', label: 'Uptime SLA', icon: Zap },
  { value: 'SOC 2', label: 'Enterprise Security', icon: Shield },
  { value: '< 5min', label: 'Setup Time', icon: Target },
];

export function LDIntegrationPage({ onNavigate }: Props) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Navbar onNavigate={onNavigate} currentScreen="enterprise-hiring" />

      <main className="flex-1 pt-20">
        <section className="relative py-14 md:py-20 px-4 overflow-hidden" style={{ backgroundColor: BRAND.primary }} data-testid="integration-hero-section">
          <div className="absolute inset-0 opacity-[0.05]">
            <div className="absolute top-12 left-[8%] w-48 h-48 rounded-full border border-white" />
            <div className="absolute bottom-12 right-[6%] w-72 h-72 rounded-full border border-white" />
            <div className="absolute top-[30%] right-[25%] w-32 h-32 rounded-full border border-white" />
          </div>

          <div className="max-w-6xl mx-auto relative">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="text-white">
                <div className="flex items-center gap-2 mb-5">
                  <Badge className="bg-white/15 text-white border-0 text-xs px-3 py-1.5 font-medium" data-testid="badge-integration-solution">
                    <Plug size={12} className="mr-1" /> Solution
                  </Badge>
                  <Badge className="border-0 text-xs px-3 py-1.5 font-semibold" style={{ backgroundColor: `${BRAND.accent}30`, color: BRAND.accent }} data-testid="badge-integration-enterprise">
                    ENTERPRISE
                  </Badge>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold mb-3 leading-tight tracking-tight" data-testid="text-integration-title">
                  L&D Integration Hub
                </h1>
                <p className="text-base font-medium mb-2 text-white/90 leading-relaxed" data-testid="text-integration-subtitle">
                  Plug Into Your Existing Learning Ecosystem
                </p>
                <p className="text-sm text-white/65 mb-6 leading-relaxed max-w-md" data-testid="text-integration-desc">
                  Connect MetryxOne with your LMS, HRIS, and corporate learning platforms.
                  API-first architecture with pre-built connectors for 50+ enterprise systems.
                  Enterprise-grade security with SSO, SCIM, and compliance automation.
                </p>
                <div className="flex flex-col sm:flex-row gap-2.5 mb-6">
                  <Button
                    className="text-white font-medium h-10 px-6 text-sm rounded-lg"
                    style={{ backgroundColor: BRAND.accent }}
                    onClick={() => onNavigate('request-demo')}
                    data-testid="btn-integration-get-started"
                  >
                    Get Started <ArrowRight size={15} className="ml-1.5" />
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/25 text-white hover:bg-white/10 h-10 px-6 text-sm font-medium rounded-lg"
                    onClick={() => onNavigate('docs')}
                    data-testid="btn-integration-view-docs"
                  >
                    View API Docs
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-xs text-white/70 font-medium" data-testid="integration-trust-badges">
                  <span className="flex items-center gap-1.5" data-testid="trust-integration-api">
                    <CheckCircle size={13} style={{ color: BRAND.accent }} /> API-First Design
                  </span>
                  <span className="flex items-center gap-1.5" data-testid="trust-integration-sso">
                    <Shield size={13} style={{ color: BRAND.accent }} /> SSO & SCIM
                  </span>
                  <span className="flex items-center gap-1.5" data-testid="trust-integration-uptime">
                    <CheckCircle size={13} style={{ color: BRAND.accent }} /> 99.9% Uptime
                  </span>
                  <span className="flex items-center gap-1.5" data-testid="trust-integration-soc2">
                    <Zap size={13} style={{ color: BRAND.accent }} /> SOC 2 Compliant
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Plug, value: '50+', label: 'Integrations', sub: 'pre-built connectors' },
                    { icon: Zap, value: '99.9%', label: 'Uptime SLA', sub: 'enterprise reliability' },
                  ].map((stat, idx) => (
                    <Card key={idx} className="bg-white/10 border-0" data-testid={`integration-stat-card-${idx}`}>
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
                    { icon: Shield, value: 'SOC 2', label: 'Enterprise Security', sub: 'GDPR & DPDP ready' },
                    { icon: Globe, value: '< 5min', label: 'Setup Time', sub: 'plug and play' },
                  ].map((stat, idx) => (
                    <Card key={idx + 2} className="bg-white/10 border-0" data-testid={`integration-stat-card-${idx + 2}`}>
                      <CardContent className="p-4 text-center text-white">
                        <stat.icon size={22} className="mx-auto mb-2" style={{ color: BRAND.accent }} />
                        <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                        <p className="text-xs font-semibold text-white/85 mt-0.5">{stat.label}</p>
                        <p className="text-[10px] text-white/45 mt-0.5">{stat.sub}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Card className="bg-white/10 border-0" data-testid="integration-compliance-card">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 text-white">
                      <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.accent}25` }}>
                        <Award size={20} style={{ color: BRAND.accent }} />
                      </div>
                      <div>
                        <p className="text-xs font-bold">Enterprise-Grade Security</p>
                        <p className="text-[10px] text-white/55">SOC 2, GDPR, DPDP compliant with end-to-end encryption</p>
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

        <section className="py-10 px-4" data-testid="integration-impact-strip">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {IMPACT_STATS.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: `${BRAND.primary}04` }} data-testid={`integration-impact-${i}`}>
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

        <section className="py-14 px-4" style={{ backgroundColor: 'var(--bg-secondary)' }} data-testid="integration-features-section">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-5 gap-10 items-start">
              <div className="lg:col-span-2">
                <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.accent}20`, color: BRAND.accent }} data-testid="badge-integration-features">
                  Platform Features
                </Badge>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-3" style={{ color: BRAND.primary }} data-testid="text-integration-features-title">
                  Connect Everything
                </h2>
                <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }} data-testid="text-integration-features-desc">
                  Enterprise integration capabilities built for complex learning ecosystems —
                  from LMS connectors to custom API workflows.
                </p>
                <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
                  Every integration is designed for reliability, security, and seamless
                  data flow across your entire HR technology stack.
                </p>
                <Button
                  className="font-medium px-6 h-9 rounded-lg text-white text-sm"
                  style={{ backgroundColor: BRAND.accent }}
                  onClick={() => onNavigate('request-demo')}
                  data-testid="btn-integration-features-demo"
                >
                  <Play size={14} className="mr-1.5" /> See It in Action
                </Button>
              </div>
              <div className="lg:col-span-3 grid sm:grid-cols-2 gap-4" data-testid="integration-features-grid">
                {FEATURES.map((feature, idx) => (
                  <Card key={idx} className="border-0 shadow-sm hover:shadow-md transition-all group" data-testid={`integration-feature-card-${idx}`}>
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

        <section className="py-14 px-4" style={{ backgroundColor: 'var(--bg-secondary)' }} data-testid="integration-use-cases-section">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }} data-testid="badge-integration-use-cases">
                Use Cases
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }} data-testid="text-integration-use-cases-title">
                Integration for Every Enterprise Need
              </h2>
              <p className="mt-2 text-sm max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }} data-testid="text-integration-use-cases-desc">
                From single-platform deployment to complex multi-system orchestration
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {USE_CASES.map((uc, idx) => (
                <Card key={idx} className="border-0 shadow-sm hover:shadow-md transition-all overflow-hidden group" data-testid={`integration-use-case-${idx}`}>
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

        <section className="py-14 px-4" data-testid="integration-how-it-works-section">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }} data-testid="badge-integration-how">
                Simple Process
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }} data-testid="text-integration-how-title">
                Get Connected in 3 Steps
              </h2>
              <p className="mt-2 text-sm max-w-lg mx-auto" style={{ color: 'var(--text-secondary)' }} data-testid="text-integration-how-desc">
                From system connection to seamless data flow
              </p>
            </div>

            <div className="relative">
              <div className="hidden md:block absolute top-14 left-[16%] right-[16%] h-px" style={{ backgroundColor: `${BRAND.accent}20` }} />
              <div className="grid md:grid-cols-3 gap-6">
                {HOW_IT_WORKS.map((step) => (
                  <div key={step.step} className="relative text-center" data-testid={`integration-step-${step.step}`}>
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

        <section className="py-16 px-4" style={{ backgroundColor: BRAND.primary }} data-testid="integration-cta-section">
          <div className="max-w-3xl mx-auto text-center">
            <div className="h-12 w-12 rounded-xl bg-white/12 flex items-center justify-center mx-auto mb-5">
              <Plug size={24} className="text-white" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 tracking-tight" data-testid="text-integration-cta">
              Connect Your <span style={{ color: BRAND.accent }}>Learning Ecosystem</span>
            </h2>
            <p className="text-white/65 text-sm mb-8 max-w-lg mx-auto leading-relaxed" data-testid="text-integration-cta-desc">
              Join forward-thinking enterprises using MetryxOne to unify their L&D technology stack with enterprise-grade integrations.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 mb-6">
              <Button
                className="h-10 px-8 font-medium text-sm rounded-lg text-white"
                style={{ backgroundColor: BRAND.accent }}
                onClick={() => onNavigate('request-demo')}
                data-testid="btn-integration-cta-demo"
              >
                Request a Demo <ArrowRight size={15} className="ml-1.5" />
              </Button>
              <Button
                variant="outline"
                className="h-10 px-8 font-medium text-sm border-white/25 text-white hover:bg-white/10 rounded-lg"
                onClick={() => onNavigate('support')}
                data-testid="btn-integration-cta-contact"
              >
                Contact Sales
              </Button>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-white/50 text-xs" data-testid="integration-cta-trust">
              <span className="flex items-center gap-1.5" data-testid="cta-trust-integrations"><Plug size={13} /> 50+ integrations</span>
              <span className="flex items-center gap-1.5" data-testid="cta-trust-uptime"><Zap size={13} /> 99.9% uptime SLA</span>
              <span className="flex items-center gap-1.5" data-testid="cta-trust-security"><Shield size={13} /> Enterprise-grade security</span>
            </div>
          </div>
        </section>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
