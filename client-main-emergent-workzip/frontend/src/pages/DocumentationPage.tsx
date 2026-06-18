import {
  BookOpen, Code, FileText, Search, ArrowRight,
  Layers, Zap, Shield, Terminal, CheckCircle,
  ChevronRight, ExternalLink, Copy, Play,
  Database, Users, Brain, Webhook, Monitor,
  Key, Settings, Globe, Lock, Star
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

const API_CATEGORIES = [
  {
    icon: Brain, title: 'Assessment API', desc: 'Create, manage, and deploy LBI behavioral assessments across 19 domains and 97 subdomains.',
    endpoints: ['POST /assessments/create', 'GET /assessments/{id}/status', 'POST /assessments/{id}/submit'],
  },
  {
    icon: FileText, title: 'Reports API', desc: 'Generate and retrieve comprehensive behavioral intelligence reports with AI-powered insights.',
    endpoints: ['GET /reports/{id}', 'POST /reports/generate', 'GET /reports/{id}/pdf'],
  },
  {
    icon: Users, title: 'User Management API', desc: 'Manage students, parents, institutes, and admin accounts with role-based access control.',
    endpoints: ['POST /users/create', 'GET /users/{id}/profile', 'PUT /users/{id}/roles'],
  },
  {
    icon: Database, title: 'Analytics API', desc: 'Access cohort analytics, performance trends, and behavioral pattern data at scale.',
    endpoints: ['GET /analytics/cohort/{id}', 'GET /analytics/trends', 'POST /analytics/export'],
  },
  {
    icon: Webhook, title: 'Webhooks API', desc: 'Configure real-time event notifications for assessment completions, score updates, and alerts.',
    endpoints: ['POST /webhooks/register', 'GET /webhooks/list', 'DELETE /webhooks/{id}'],
  },
  {
    icon: Monitor, title: 'Embed SDK', desc: 'Drop-in components for embedding assessments, reports, and dashboards into your platform.',
    endpoints: ['React: @metryx/react-sdk', 'Angular: @metryx/angular-sdk', 'JS: metryx-embed.js'],
  },
];

const QUICK_START_STEPS = [
  { step: 1, title: 'Get API Key', desc: 'Register and obtain your API credentials from the developer portal.', icon: Key },
  { step: 2, title: 'Install SDK', desc: 'Add the MetryxOne SDK to your project using npm, yarn, or CDN.', icon: Terminal },
  { step: 3, title: 'Make First Call', desc: 'Create your first assessment and retrieve results via the API.', icon: Play },
  { step: 4, title: 'Go Live', desc: 'Switch to production keys and start serving real users.', icon: Globe },
];

const SDK_GUIDES = [
  { title: 'React Integration', desc: 'Complete guide for React and Next.js applications', lang: 'TypeScript', icon: Code },
  { title: 'Angular Integration', desc: 'Step-by-step setup for Angular applications', lang: 'TypeScript', icon: Code },
  { title: 'Vanilla JavaScript', desc: 'CDN-based integration for any web platform', lang: 'JavaScript', icon: Code },
  { title: 'Python SDK', desc: 'Server-side integration for Python backends', lang: 'Python', icon: Terminal },
  { title: 'Node.js SDK', desc: 'Server-side integration for Node.js backends', lang: 'Node.js', icon: Terminal },
  { title: 'REST API Reference', desc: 'Complete OpenAPI specification and endpoint reference', lang: 'REST', icon: FileText },
];

export function DocumentationPage({ onNavigate }: Props) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Navbar onNavigate={onNavigate} currentScreen="docs" />

      <main className="flex-1 pt-20">
        <section className="relative py-14 md:py-20 px-4 overflow-hidden" style={{ backgroundColor: BRAND.primary }} data-testid="docs-hero-section">
          <div className="absolute inset-0 opacity-[0.05]">
            <div className="absolute top-12 left-[8%] w-48 h-48 rounded-full border border-white" />
            <div className="absolute bottom-12 right-[6%] w-72 h-72 rounded-full border border-white" />
          </div>

          <div className="max-w-6xl mx-auto relative">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 mb-5">
                <Badge className="bg-white/15 text-white border-0 text-xs px-3 py-1.5 font-medium" data-testid="badge-docs-resource">
                  <BookOpen size={12} className="mr-1" /> Developer Resource
                </Badge>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-3 leading-tight tracking-tight text-white" data-testid="text-docs-title">
                Documentation
              </h1>
              <p className="text-base font-medium mb-2 text-white/90" data-testid="text-docs-subtitle">
                Technical Guides, API Reference & Integration Docs
              </p>
              <p className="text-sm text-white/65 mb-6 max-w-lg leading-relaxed" data-testid="text-docs-desc">
                Everything you need to integrate MetryxOne into your platform. Comprehensive API documentation,
                SDKs for popular frameworks, code samples, and developer support.
              </p>
              <div className="flex flex-col sm:flex-row gap-2.5 mb-6">
                <Button
                  className="text-white font-medium h-10 px-6 text-sm rounded-lg"
                  style={{ backgroundColor: BRAND.accent }}
                  onClick={() => onNavigate('request-demo')}
                  data-testid="btn-docs-get-api"
                >
                  Get API Access <ArrowRight size={15} className="ml-1.5" />
                </Button>
                <Button
                  variant="outline"
                  className="border-white/25 text-white hover:bg-white/10 h-10 px-6 text-sm font-medium rounded-lg"
                  data-testid="btn-docs-quickstart"
                >
                  <Play size={14} className="mr-1.5" /> Quick Start Guide
                </Button>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-white/60 font-medium" data-testid="docs-trust">
                <span className="flex items-center gap-1.5"><CheckCircle size={13} style={{ color: BRAND.accent }} /> OpenAPI 3.0 Spec</span>
                <span className="flex items-center gap-1.5"><CheckCircle size={13} style={{ color: BRAND.accent }} /> Postman Collection</span>
                <span className="flex items-center gap-1.5"><CheckCircle size={13} style={{ color: BRAND.accent }} /> Sandbox Environment</span>
              </div>
            </div>
          </div>
        </section>

        <section className="py-10 px-4" data-testid="docs-search-section">
          <div className="max-w-3xl mx-auto">
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="Search documentation... (e.g., 'create assessment', 'webhook setup', 'React SDK')"
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border text-sm focus:outline-none focus:ring-2"
                style={{ borderColor: `${BRAND.primary}15`, focusRingColor: BRAND.accent } as any}
                data-testid="input-docs-search"
              />
            </div>
          </div>
        </section>

        <section className="py-12 px-4" data-testid="docs-quickstart-section">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }} data-testid="badge-docs-quickstart">
                Quick Start
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }} data-testid="text-docs-quickstart-title">
                Up and Running in Minutes
              </h2>
            </div>
            <div className="relative">
              <div className="hidden md:block absolute top-10 left-[12%] right-[12%] h-px" style={{ backgroundColor: `${BRAND.accent}20` }} />
              <div className="grid md:grid-cols-4 gap-5">
                {QUICK_START_STEPS.map((s) => (
                  <div key={s.step} className="relative text-center" data-testid={`docs-step-${s.step}`}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-3 text-white font-bold text-xs relative z-10" style={{ backgroundColor: BRAND.primary }}>
                      {s.step}
                    </div>
                    <Card className="border-0 shadow-sm hover:shadow-md transition-all">
                      <CardContent className="p-5 text-center">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center mx-auto mb-2.5" style={{ backgroundColor: `${BRAND.accent}10` }}>
                          <s.icon size={18} style={{ color: BRAND.accent }} />
                        </div>
                        <h4 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{s.title}</h4>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{s.desc}</p>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-14 px-4" style={{ backgroundColor: 'var(--bg-secondary)' }} data-testid="docs-api-section">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-8">
              <div>
                <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }} data-testid="badge-docs-api">
                  API Reference
                </Badge>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }} data-testid="text-docs-api-title">
                  API Categories
                </h2>
                <p className="mt-1.5 text-sm max-w-xl" style={{ color: 'var(--text-secondary)' }}>
                  Explore our comprehensive REST API organized by functional area
                </p>
              </div>
              <Button
                variant="outline"
                className="font-medium px-5 h-9 rounded-lg shrink-0 text-sm"
                style={{ borderColor: BRAND.primary, color: BRAND.primary }}
                data-testid="btn-docs-openapi"
              >
                <FileText size={13} className="mr-1.5" /> Download OpenAPI Spec
              </Button>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {API_CATEGORIES.map((cat, idx) => (
                <Card key={idx} className="border-0 shadow-sm hover:shadow-md transition-all group cursor-pointer" data-testid={`docs-api-card-${idx}`}>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
                        style={{ backgroundColor: `${idx % 2 === 0 ? BRAND.primary : BRAND.accent}10` }}>
                        <cat.icon size={20} style={{ color: idx % 2 === 0 ? BRAND.primary : BRAND.accent }} />
                      </div>
                      <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{cat.title}</h3>
                    </div>
                    <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>{cat.desc}</p>
                    <div className="space-y-1">
                      {cat.endpoints.map((ep, i) => (
                        <div key={i} className="flex items-center gap-2 p-1.5 rounded-md" style={{ backgroundColor: `${BRAND.primary}04` }}>
                          <code className="text-[10px] font-mono" style={{ color: BRAND.primary }}>{ep}</code>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-1 mt-3 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: BRAND.accent }}>
                      View full reference <ChevronRight size={12} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-14 px-4" data-testid="docs-sdk-section">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }} data-testid="badge-docs-sdk">
                SDK & Guides
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }} data-testid="text-docs-sdk-title">
                Integration Guides
              </h2>
              <p className="mt-2 text-sm max-w-lg mx-auto" style={{ color: 'var(--text-secondary)' }}>
                Step-by-step guides for every platform and framework
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {SDK_GUIDES.map((guide, idx) => (
                <Card key={idx} className="border-0 shadow-sm hover:shadow-md transition-all group cursor-pointer" data-testid={`docs-guide-${idx}`}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}08` }}>
                          <guide.icon size={16} style={{ color: BRAND.primary }} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{guide.title}</h4>
                        </div>
                      </div>
                      <Badge className="text-[9px] border-0 px-2 py-0.5" style={{ backgroundColor: `${BRAND.accent}12`, color: BRAND.accent }}>{guide.lang}</Badge>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{guide.desc}</p>
                    <div className="flex items-center gap-1 mt-3 text-xs font-medium" style={{ color: BRAND.accent }}>
                      Read guide <ChevronRight size={12} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-14 px-4" style={{ backgroundColor: 'var(--bg-secondary)' }} data-testid="docs-code-sample-section">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-8 items-start">
              <div>
                <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }} data-testid="badge-docs-sample">
                  Code Sample
                </Badge>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-3" style={{ color: BRAND.primary }} data-testid="text-docs-sample-title">
                  Start with a Few Lines of Code
                </h2>
                <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
                  Integrate LBI assessments into your application with minimal setup. Our SDK handles
                  authentication, session management, and result retrieval automatically.
                </p>
                <div className="space-y-3">
                  {[
                    { label: 'Full TypeScript support', icon: CheckCircle },
                    { label: 'Auto-retry and error handling', icon: CheckCircle },
                    { label: 'Built-in rate limiting', icon: CheckCircle },
                    { label: 'Webhook signature verification', icon: CheckCircle },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2" data-testid={`docs-feature-${i}`}>
                      <item.icon size={14} style={{ color: BRAND.accent }} />
                      <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Card className="border-0 shadow-md overflow-hidden" data-testid="docs-code-block">
                <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: BRAND.primary }}>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                      <div className="w-2.5 h-2.5 rounded-full bg-teal-400/60" />
                    </div>
                    <span className="text-white/60 text-[10px] font-mono ml-2">assessment.ts</span>
                  </div>
                  <Button variant="ghost" className="h-6 px-2 text-white/40 hover:text-white/80 hover:bg-white/10">
                    <Copy size={12} />
                  </Button>
                </div>
                <div className="p-4 font-mono text-[11px] leading-relaxed" style={{ backgroundColor: '#1e293b', color: '#e2e8f0' }}>
                  <div><span style={{ color: '#c084fc' }}>import</span> {'{'} MetryxClient {'}'} <span style={{ color: '#c084fc' }}>from</span> <span style={{ color: BRAND.accent }}>'@metryx/sdk'</span>;</div>
                  <div className="mt-2"><span style={{ color: '#c084fc' }}>const</span> client = <span style={{ color: '#c084fc' }}>new</span> <span style={{ color: '#60a5fa' }}>MetryxClient</span>({'{'}</div>
                  <div>&nbsp;&nbsp;apiKey: process.env.<span style={{ color: '#fbbf24' }}>METRYX_API_KEY</span>,</div>
                  <div>{'}'});</div>
                  <div className="mt-2 text-white/30">{'// Create and start an assessment'}</div>
                  <div><span style={{ color: '#c084fc' }}>const</span> assessment = <span style={{ color: '#c084fc' }}>await</span> client.<span style={{ color: '#60a5fa' }}>assessments</span>.<span style={{ color: '#60a5fa' }}>create</span>({'{'}</div>
                  <div>&nbsp;&nbsp;studentId: <span style={{ color: BRAND.accent }}>'STU_2847'</span>,</div>
                  <div>&nbsp;&nbsp;type: <span style={{ color: BRAND.accent }}>'lbi_full'</span>,</div>
                  <div>&nbsp;&nbsp;domains: <span style={{ color: BRAND.accent }}>'all'</span>,</div>
                  <div>{'}'});</div>
                  <div className="mt-2 text-white/30">{'// Get the report when ready'}</div>
                  <div><span style={{ color: '#c084fc' }}>const</span> report = <span style={{ color: '#c084fc' }}>await</span> client.<span style={{ color: '#60a5fa' }}>reports</span>.<span style={{ color: '#60a5fa' }}>get</span>(assessment.id);</div>
                  <div>console.<span style={{ color: '#60a5fa' }}>log</span>(report.lbiScore); <span className="text-white/30">{'// 72.4'}</span></div>
                </div>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-14 px-4" data-testid="docs-full-docs-section">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }}>
                Full Documentation
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }}>
                Download Platform Reference Docs
              </h2>
              <p className="mt-2 text-sm max-w-lg mx-auto" style={{ color: 'var(--text-secondary)' }}>
                Comprehensive end-to-end documentation covering architecture, APIs, database schema, and admin guides
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-5 max-w-3xl mx-auto">
              {[
                {
                  title: 'MetryxOne Platform Documentation',
                  desc: 'Complete platform reference — all product modules, API routes, database schema, user flows, and admin dashboard guide.',
                  href: '/docs/MetryxOne_Platform_Documentation.md',
                  tag: 'Platform',
                  tagColor: BRAND.primary,
                  items: ['Architecture & tech stack', 'All API routes', 'Database schema', 'Admin dashboard guide'],
                },
                {
                  title: 'CAPADEX Documentation',
                  desc: 'Full CAPADEX behavioral intelligence reference — assessment flow, scoring engine, signal intelligence, CSI, and admin panels.',
                  href: '/docs/CAPADEX_Documentation.md',
                  tag: 'CAPADEX',
                  tagColor: BRAND.accent,
                  items: ['End-to-end user flow', 'Scoring engine', 'Signal intelligence', 'CSI & gamification'],
                },
              ].map((doc) => (
                <a
                  key={doc.href}
                  href={doc.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block no-underline group"
                >
                  <Card className="border shadow-sm hover:shadow-md transition-all h-full group-hover:border-[var(--accent-primary)]">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${doc.tagColor}10` }}>
                          <FileText size={20} style={{ color: doc.tagColor }} />
                        </div>
                        <Badge className="text-[10px] border-0 px-2 py-0.5" style={{ backgroundColor: `${doc.tagColor}12`, color: doc.tagColor }}>
                          {doc.tag}
                        </Badge>
                      </div>
                      <h3 className="text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{doc.title}</h3>
                      <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>{doc.desc}</p>
                      <ul className="space-y-1 mb-4">
                        {doc.items.map((item) => (
                          <li key={item} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                            <CheckCircle size={11} style={{ color: doc.tagColor }} />
                            {item}
                          </li>
                        ))}
                      </ul>
                      <div className="flex items-center gap-1 text-xs font-medium" style={{ color: doc.tagColor }}>
                        <ExternalLink size={12} /> Open documentation
                      </div>
                    </CardContent>
                  </Card>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 px-4" style={{ backgroundColor: BRAND.primary }} data-testid="docs-cta-section">
          <div className="max-w-3xl mx-auto text-center">
            <div className="h-12 w-12 rounded-xl bg-white/12 flex items-center justify-center mx-auto mb-5">
              <Terminal size={24} className="text-white" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 tracking-tight" data-testid="text-docs-cta">
              Ready to <span style={{ color: BRAND.accent }}>Build</span>?
            </h2>
            <p className="text-white/65 text-sm mb-8 max-w-lg mx-auto leading-relaxed" data-testid="text-docs-cta-desc">
              Get your API key and start integrating MetryxOne behavioral intelligence into your platform today.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 mb-6">
              <Button className="h-10 px-8 font-medium text-sm rounded-lg text-white" style={{ backgroundColor: BRAND.accent }} onClick={() => onNavigate('request-demo')} data-testid="btn-docs-cta-api">
                Get API Key <ArrowRight size={15} className="ml-1.5" />
              </Button>
              <Button variant="outline" className="h-10 px-8 font-medium text-sm border-white/25 text-white hover:bg-white/10 rounded-lg" onClick={() => onNavigate('support')} data-testid="btn-docs-cta-support">
                Developer Support
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
