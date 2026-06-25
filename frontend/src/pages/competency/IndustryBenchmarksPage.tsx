import { useState, useEffect } from 'react';
import {
  BarChart3, Activity, TrendingUp, TrendingDown, Minus,
  ArrowRight, Shield, Zap, Users, Star, Award, ChevronRight,
  Globe, Target, BookOpen, Lock, Info
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Screen } from '../../App';
import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';

const BRAND = { primary: '#344E86', accent: '#4ECDC4' };

const INDUSTRIES = ['Technology', 'Finance', 'Healthcare', 'Education', 'Manufacturing', 'Consulting', 'E-Commerce'];
const INDUSTRY_COLORS: Record<string, string> = {
  Technology: '#6366f1', Finance: '#0ea5e9', Healthcare: '#10b981',
  Education: '#f59e0b', Manufacturing: '#8b5cf6', Consulting: '#ec4899', 'E-Commerce': '#f97316',
};
const INDUSTRY_DESC: Record<string, string> = {
  Technology: 'SaaS, engineering, product, data',
  Finance: 'Banking, investment, fintech, insurance',
  Healthcare: 'Clinical, pharma, health-tech, biotech',
  Education: 'EdTech, academic, training, coaching',
  Manufacturing: 'Operations, supply chain, industrial',
  Consulting: 'Strategy, management, professional services',
  'E-Commerce': 'Retail, D2C, marketplace, logistics',
};
const INDUSTRY_COHORT: Record<string, string> = {
  Technology: '3,200+', Finance: '1,800+', Healthcare: '1,400+',
  Education: '900+', Manufacturing: '700+', Consulting: '1,100+', 'E-Commerce': '800+',
};

const DEMO_DATA: Record<string, { competency: string; domain: string; yourScore: number; mean: number; p75: number; percentile: number }[]> = {
  Technology: [
    { competency: 'Systems Design', domain: 'Engineering', yourScore: 74, mean: 68, p75: 78, percentile: 61 },
    { competency: 'Data Analysis', domain: 'Analytics', yourScore: 61, mean: 65, p75: 80, percentile: 38 },
    { competency: 'Strategic Thinking', domain: 'Leadership', yourScore: 52, mean: 70, p75: 82, percentile: 22 },
    { competency: 'Stakeholder Mgmt', domain: 'Influence', yourScore: 68, mean: 63, p75: 76, percentile: 58 },
    { competency: 'Executive Communication', domain: 'Communication', yourScore: 71, mean: 66, p75: 79, percentile: 55 },
  ],
};

const apiFetch = async (url: string) => {
  const token = localStorage.getItem('metryx_token');
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

function PercentileBar({ value, p75 }: { value: number; p75: number }) {
  const color = value >= 75 ? '#10b981' : value >= 50 ? BRAND.accent : value >= 25 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="relative flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="absolute inset-y-0 left-0 rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: color }} />
        <div className="absolute inset-y-0 top-0 w-px bg-gray-400 opacity-40" style={{ left: `${p75}%` }} />
      </div>
      <span className="text-[10px] font-bold w-8 text-right" style={{ color }}>{value}th</span>
    </div>
  );
}

function DemoTable({ industry }: { industry: string }) {
  const rows = DEMO_DATA[industry] ?? DEMO_DATA['Technology'];
  return (
    <div className="divide-y divide-gray-50">
      {rows.map(r => {
        const diff = r.yourScore - r.mean;
        const diffColor = diff > 0 ? '#10b981' : '#ef4444';
        return (
          <div key={r.competency} className="flex items-center gap-3 py-2">
            <div className="w-28 flex-shrink-0">
              <p className="text-[10px] font-semibold text-gray-700 leading-tight">{r.competency}</p>
              <p className="text-[9px] text-gray-400">{r.domain}</p>
            </div>
            <div className="flex-1">
              <PercentileBar value={r.percentile} p75={75} />
            </div>
            <div className="text-right flex-shrink-0">
              <span className="text-[10px] font-bold" style={{ color: diffColor }}>{diff > 0 ? '+' : ''}{diff}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function IndustryBenchmarksPage({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const [userId, setUserId] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('Technology');

  useEffect(() => {
    apiFetch('/api/user').then((d: any) => { const u = d?.user ?? d; if (u?.id) setUserId(u.id); }).catch(() => {});
  }, []);

  const benchQuery = useQuery({
    queryKey: ['comp-benchmark', userId],
    queryFn: () => apiFetch(`/api/competency/get-percentile/${userId}`),
    enabled: !!userId,
  });

  const data = benchQuery.data;
  const groupedByDomain = data?.percentiles?.reduce((acc: Record<string, any[]>, p: any) => {
    if (!acc[p.domainName]) acc[p.domainName] = [];
    acc[p.domainName].push(p);
    return acc;
  }, {});

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar onNavigate={onNavigate} currentScreen="competency-benchmarks" />

      <main className="flex-1 pt-16">
        {!userId ? (
          <>
            {/* ── Hero ── */}
            <div className="border-b border-gray-100 bg-gray-50">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
                  {/* Left */}
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border mb-4" style={{ borderColor: BRAND.primary, color: BRAND.primary, backgroundColor: `${BRAND.primary}08` }}>
                      <BarChart3 className="h-3 w-3" /> Industry Benchmarks Engine™
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold mb-4 leading-tight" style={{ color: BRAND.primary }}>
                      See exactly where you rank across 7 industries
                    </h1>
                    <p className="text-gray-500 text-sm leading-relaxed mb-6">
                      MetryxOne's Industry Benchmarks Engine compares your competency scores against verified cohort benchmarks — giving you a precise percentile rank across Technology, Finance, Healthcare, and 4 more industries. Know your position. Own your career.
                    </p>
                    <div className="grid grid-cols-3 gap-3 mb-6">
                      {[
                        { value: '7', label: 'Industry cohorts' },
                        { value: '50', label: 'Benchmarked skills' },
                        { value: 'P25–P90', label: 'Percentile precision' },
                      ].map(s => (
                        <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                          <div className="text-xl font-extrabold" style={{ color: BRAND.primary }}>{s.value}</div>
                          <div className="text-[10px] text-gray-400 font-medium mt-0.5 leading-tight">{s.label}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button onClick={() => onNavigate('registration')} style={{ backgroundColor: BRAND.primary }} className="text-white px-6 font-semibold">
                        Get My Benchmark Report <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                      </Button>
                      <Button variant="outline" onClick={() => onNavigate('request-demo')} className="px-6">
                        Request Enterprise Demo
                      </Button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-3 flex items-center gap-1">
                      <Shield className="h-3 w-3" /> SOC 2 compliant · GDPR ready · No credit card required
                    </p>
                  </div>

                  {/* Right — Demo benchmark preview */}
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold" style={{ color: BRAND.primary }}>Sample Benchmark Report</p>
                        <p className="text-[10px] text-gray-400">Senior Product Manager · Technology cohort</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-red-400" />
                        <div className="w-2 h-2 rounded-full bg-yellow-400" />
                        <div className="w-2 h-2 rounded-full bg-teal-400" />
                      </div>
                    </div>

                    {/* Industry tabs */}
                    <div className="px-4 pt-3 pb-0 flex gap-2 overflow-x-auto border-b border-gray-100 scrollbar-hide">
                      {['Technology', 'Finance', 'Healthcare'].map(ind => (
                        <button
                          key={ind}
                          onClick={() => setSelectedIndustry(ind)}
                          className={`text-[10px] font-semibold pb-2 border-b-2 whitespace-nowrap transition-colors px-1 ${selectedIndustry === ind ? 'border-current' : 'border-transparent text-gray-400'}`}
                          style={selectedIndustry === ind ? { color: INDUSTRY_COLORS[ind], borderColor: INDUSTRY_COLORS[ind] } : {}}
                        >
                          {ind}
                        </button>
                      ))}
                    </div>

                    {/* Demo table */}
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between text-[9px] text-gray-400 uppercase tracking-wide mb-2">
                        <span>Competency</span>
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1"><span className="w-6 h-0.5 bg-gray-300 inline-block" /> P75 marker</span>
                          <span>Percentile</span>
                        </div>
                      </div>
                      <DemoTable industry={selectedIndustry} />
                    </div>

                    <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between bg-gray-50">
                      <p className="text-[10px] text-gray-400 flex items-center gap-1"><Lock className="h-3 w-3" /> Demo data — yours is private</p>
                      <button onClick={() => onNavigate('registration')} className="text-[10px] font-semibold flex items-center gap-0.5" style={{ color: BRAND.primary }}>
                        See mine <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Trust bar ── */}
            <div className="border-b border-gray-100">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  {[
                    { icon: Users, value: '9,900+', label: 'Active cohort members' },
                    { icon: Globe, value: '7', label: 'Industry verticals' },
                    { icon: BarChart3, value: '50', label: 'Skills benchmarked' },
                    { icon: Star, value: 'Quarterly', label: 'Cohort refresh cycle' },
                  ].map(({ icon: Icon, value, label }) => (
                    <div key={label} className="flex flex-col items-center gap-1">
                      <Icon className="h-4 w-4 text-gray-300 mb-0.5" />
                      <p className="text-lg font-extrabold" style={{ color: BRAND.primary }}>{value}</p>
                      <p className="text-[10px] text-gray-400">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Industries grid ── */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: BRAND.primary }}>7 industry cohorts — one unified benchmark</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Each cohort is built from verified professional assessments within that sector</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {INDUSTRIES.map(ind => (
                  <div key={ind} className="border border-gray-200 rounded-xl p-4 bg-white hover:border-gray-300 transition-colors">
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${INDUSTRY_COLORS[ind]}15` }}>
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: INDUSTRY_COLORS[ind] }} />
                      </div>
                      <h3 className="text-sm font-bold" style={{ color: BRAND.primary }}>{ind}</h3>
                    </div>
                    <p className="text-[10px] text-gray-400 leading-relaxed mb-2.5">{INDUSTRY_DESC[ind]}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold" style={{ color: INDUSTRY_COLORS[ind] }}>{INDUSTRY_COHORT[ind]} cohort</span>
                      <Badge variant="outline" className="text-[9px] px-1.5">Live</Badge>
                    </div>
                  </div>
                ))}
                {/* Roadmap teaser: next industry on the benchmark roadmap */}
                <div className="border border-dashed border-gray-200 rounded-xl p-4 flex items-center justify-center text-center">
                  <div>
                    <Badge variant="outline" className="text-[9px] px-1.5 mb-1.5 text-gray-400">On the roadmap</Badge>
                    <p className="text-[10px] text-gray-400">Government &amp; Public Sector</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── What you get ── */}
            <div className="border-t border-gray-100 bg-gray-50">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: BRAND.primary }}>What's inside your benchmark report</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Free with every MetryxOne account</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">Free</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    {
                      icon: BarChart3, color: BRAND.primary,
                      title: 'Percentile Rank per Competency',
                      desc: 'See your exact percentile position (P25, P50, P75, P90) for every one of the 50 competencies — not just an average.',
                      tags: ['50 competencies', 'P25–P90 precision'],
                    },
                    {
                      icon: Globe, color: BRAND.accent,
                      title: 'Cross-Industry Comparison',
                      desc: 'Compare your scores against multiple industries simultaneously — see where you\'re strong in Tech but lag in Finance.',
                      tags: ['7 industries', 'Side-by-side view'],
                    },
                    {
                      icon: TrendingUp, color: '#10b981',
                      title: 'vs. Industry Mean & P75',
                      desc: 'Each competency shows your score relative to both the industry mean and the P75 benchmark — with a clear above/below indicator.',
                      tags: ['Mean vs P75', 'Gap magnitude'],
                    },
                    {
                      icon: Activity, color: '#8b5cf6',
                      title: 'Domain-Level Heatmap',
                      desc: 'Aggregate percentile view across 10 competency domains — instantly see which domains are strengths and which need work.',
                      tags: ['10 domains', 'Visual heatmap'],
                    },
                    {
                      icon: Target, color: '#f97316',
                      title: 'Role-Calibrated Benchmarks',
                      desc: 'Benchmarks are filtered to your specific role and career stage — a P75 for a Junior Engineer differs from a P75 for a Director.',
                      tags: ['Role-specific', 'Career-stage calibrated'],
                    },
                    {
                      icon: BookOpen, color: '#ec4899',
                      title: 'Benchmark-Linked Learning',
                      desc: 'Every below-benchmark competency is paired with a curated learning intervention to help you close the gap efficiently.',
                      tags: ['Linked learning', 'Priority ranked'],
                    },
                  ].map(({ icon: Icon, color, title, desc, tags }) => (
                    <div key={title} className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center gap-2.5 mb-2.5">
                        <div className="w-7 h-7 rounded-md flex items-center justify-center border border-gray-100 flex-shrink-0" style={{ backgroundColor: `${color}10` }}>
                          <Icon className="h-3.5 w-3.5" style={{ color }} />
                        </div>
                        <h3 className="text-sm font-semibold" style={{ color: BRAND.primary }}>{title}</h3>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed mb-3">{desc}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {tags.map(t => (
                          <span key={t} className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-400 font-medium">{t}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Methodology callout ── */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
              <div className="border border-gray-200 rounded-xl p-6 bg-white">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="h-4 w-4" style={{ color: BRAND.primary }} />
                      <h3 className="text-sm font-bold" style={{ color: BRAND.primary }}>Benchmark Methodology</h3>
                      <Badge variant="outline" className="text-[10px] ml-1">Peer-reviewed</Badge>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed mb-4">
                      Every industry cohort is built from verified assessment completions by professionals working in that sector. Cohort members are validated via employment verification during onboarding. Benchmarks are refreshed quarterly to account for evolving skill demands, and percentile positions are computed using a kernel density estimation model to smooth across sample sizes.
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Minimum cohort size', value: '700+' },
                        { label: 'Refresh frequency', value: 'Quarterly' },
                        { label: 'Percentile method', value: 'KDE model' },
                      ].map(m => (
                        <div key={m.label} className="border border-gray-100 rounded-lg p-2.5 text-center">
                          <p className="text-sm font-bold" style={{ color: BRAND.primary }}>{m.value}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{m.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Percentile colour key</p>
                    {[
                      { label: 'P75 and above', desc: 'Strong performer — above industry benchmark', color: '#10b981', bg: '#f0fdf4' },
                      { label: 'P50 – P74', desc: 'Solid — at or approaching benchmark', color: BRAND.accent, bg: '#f0fdfd' },
                      { label: 'P25 – P49', desc: 'Developing — below industry median', color: '#f59e0b', bg: '#fffbeb' },
                      { label: 'Below P25', desc: 'Priority gap — requires immediate focus', color: '#ef4444', bg: '#fef2f2' },
                    ].map(({ label, desc, color, bg }) => (
                      <div key={label} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                        <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                        <div>
                          <p className="text-xs font-semibold" style={{ color }}>{label}</p>
                          <p className="text-[10px] text-gray-400">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Testimonials ── */}
            <div className="border-t border-gray-100 bg-gray-50">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-center mb-5">What professionals say</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { quote: 'Seeing my exact percentile rank in Technology vs Finance was eye-opening. I was 78th percentile in Tech but only 42nd in Finance — I knew exactly where to focus.', name: 'Rohan S.', role: 'Head of Product', industry: 'FinTech' },
                    { quote: 'The domain heatmap alone was worth it. In one view I saw that my Leadership domain was P68 but Analytics was P29 — I immediately changed my development plan.', name: 'Claire M.', role: 'Senior Manager', industry: 'Consulting' },
                    { quote: 'We use MetryxOne benchmarks in every talent review. The ability to benchmark candidates against industry P75 has made our hiring calibration far more objective.', name: 'Yusuf A.', role: 'Chief People Officer', industry: 'Healthcare Technology' },
                  ].map(t => (
                    <div key={t.name} className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex gap-0.5 mb-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed mb-3 italic">"{t.quote}"</p>
                      <div className="border-t border-gray-100 pt-2.5">
                        <p className="text-xs font-semibold" style={{ color: BRAND.primary }}>{t.name}</p>
                        <p className="text-[10px] text-gray-400">{t.role} · {t.industry}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Enterprise CTA ── */}
            <div className="border-t border-gray-100">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                  <div>
                    <h3 className="text-xl font-extrabold mb-2" style={{ color: BRAND.primary }}>Get your industry benchmark report today</h3>
                    <p className="text-xs text-gray-500 leading-relaxed mb-5">
                      Benchmark yourself across all 7 industries simultaneously. See your percentile rank per competency, understand where you stand in the market, and build a data-driven development plan — free with every MetryxOne account.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button onClick={() => onNavigate('registration')} style={{ backgroundColor: BRAND.primary }} className="text-white px-6 font-semibold">
                        Get My Free Report <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                      </Button>
                      <Button variant="outline" onClick={() => onNavigate('login')} className="px-6">Log In</Button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-3 flex items-center gap-1">
                      <Shield className="h-3 w-3" /> SOC 2 Type II · GDPR compliant · Data never shared
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: Zap, title: 'Instant benchmarking', desc: 'Report generated immediately after completing your assessment.' },
                      { icon: Globe, title: 'All 7 industries', desc: 'Compare against every industry cohort in a single unified report.' },
                      { icon: Activity, title: 'Quarterly updates', desc: 'Benchmarks refresh quarterly to reflect the current talent market.' },
                      { icon: Shield, title: 'Private by default', desc: 'Your scores and percentile ranks are visible only to you.' },
                    ].map(({ icon: Icon, title, desc }) => (
                      <div key={title} className="border border-gray-200 rounded-lg p-3 bg-white">
                        <Icon className="h-3.5 w-3.5 mb-1.5" style={{ color: BRAND.primary }} />
                        <p className="text-xs font-semibold mb-0.5" style={{ color: BRAND.primary }}>{title}</p>
                        <p className="text-[10px] text-gray-400 leading-relaxed">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* ── Authenticated View ── */
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            {/* Page header */}
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-gray-200" style={{ backgroundColor: `${BRAND.primary}08` }}>
                  <BarChart3 className="h-4 w-4" style={{ color: BRAND.primary }} />
                </div>
                <div>
                  <h1 className="text-base font-bold" style={{ color: BRAND.primary }}>Industry Benchmarks</h1>
                  <p className="text-xs text-gray-400">Your competency scores vs. real industry cohort benchmarks</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => onNavigate('competency-gap-analysis')} className="text-xs">Gap Analysis</Button>
                <Button variant="outline" size="sm" onClick={() => onNavigate('competency-intelligence')} className="text-xs">← Dashboard</Button>
              </div>
            </div>

            {benchQuery.isLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="text-center">
                  <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: `${BRAND.accent} transparent transparent transparent` }} />
                  <p className="text-sm text-gray-500 font-medium">Loading benchmark data...</p>
                  <p className="text-xs text-gray-400 mt-1">Comparing against {data?.industry ?? 'your'} industry cohort</p>
                </div>
              </div>
            ) : benchQuery.isError ? (
              <div className="text-center py-16 border border-gray-200 rounded-xl">
                <BarChart3 className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-700 mb-1">Benchmark data unavailable</p>
                <p className="text-xs text-gray-400 mb-5 max-w-sm mx-auto">Ensure your profile, role, and industry are configured before loading benchmarks.</p>
                <div className="flex justify-center gap-2">
                  <Button size="sm" onClick={() => onNavigate('competency-intelligence')} style={{ backgroundColor: BRAND.primary }} className="text-white">Set Up Profile</Button>
                  <Button size="sm" variant="outline" onClick={() => benchQuery.refetch()}>Retry</Button>
                </div>
              </div>
            ) : data ? (
              <div className="space-y-5">
                {/* Overall percentile banner */}
                <div className="border border-gray-200 rounded-xl p-5 bg-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Overall Percentile Rank</p>
                      <div className="flex items-end gap-2">
                        <p className="text-4xl font-extrabold" style={{ color: BRAND.primary }}>{data.overallPercentile}<span className="text-lg">th</span></p>
                        <p className="text-xs text-gray-400 mb-1">{data.role} · {data.careerStage}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      {[
                        { label: 'Above P75', value: data.summary?.aboveP75 ?? 0, color: '#10b981' },
                        { label: 'P50–P74', value: data.summary?.p50p74 ?? 0, color: BRAND.accent },
                        { label: 'Below P50', value: data.summary?.belowP50 ?? 0, color: '#f59e0b' },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="text-center px-3">
                          <p className="text-xl font-extrabold" style={{ color }}>{value}</p>
                          <p className="text-[10px] text-gray-400">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Domain tables */}
                {groupedByDomain && Object.entries(groupedByDomain).map(([domain, percs]: [string, any]) => (
                  <Card key={domain} className="border border-gray-200 shadow-none">
                    <CardHeader className="py-3 px-4 border-b border-gray-100">
                      <CardTitle className="text-sm">{domain}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-100 bg-gray-50">
                              <th className="text-left py-2 px-4 font-semibold text-gray-500">Competency</th>
                              <th className="text-right py-2 px-4 font-semibold text-gray-500">Your Score</th>
                              <th className="text-right py-2 px-4 font-semibold text-gray-500">Industry Mean</th>
                              <th className="text-right py-2 px-4 font-semibold text-gray-500">vs Mean</th>
                              <th className="text-right py-2 px-4 font-semibold text-gray-500">Percentile</th>
                              <th className="py-2 px-4 w-32 font-semibold text-gray-500">Position</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {percs.map((p: any) => {
                              const diff = p.vsMean;
                              const DiffIcon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
                              const diffColor = diff > 0 ? '#10b981' : diff < 0 ? '#ef4444' : '#94a3b8';
                              const percColor = p.percentile >= 75 ? '#10b981' : p.percentile >= 50 ? BRAND.accent : p.percentile >= 25 ? '#f59e0b' : '#ef4444';
                              return (
                                <tr key={p.competencyId} className="hover:bg-gray-50 transition-colors">
                                  <td className="py-2.5 px-4 font-medium text-gray-800">{p.competencyName}</td>
                                  <td className="py-2.5 px-4 text-right font-bold" style={{ color: BRAND.primary }}>{p.userScore}</td>
                                  <td className="py-2.5 px-4 text-right text-gray-400">{Math.round(p.benchmarkMean)}</td>
                                  <td className="py-2.5 px-4 text-right">
                                    <span className="inline-flex items-center justify-end gap-0.5 font-semibold" style={{ color: diffColor }}>
                                      <DiffIcon className="h-3 w-3" />{diff > 0 ? '+' : ''}{diff}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-4 text-right">
                                    <span className="font-bold" style={{ color: percColor }}>{p.percentile}th</span>
                                  </td>
                                  <td className="py-2.5 px-4">
                                    <PercentileBar value={p.percentile} p75={75} />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Bottom quick actions */}
                <div className="border border-gray-200 rounded-xl p-4 bg-white">
                  <p className="text-xs font-semibold text-gray-500 mb-3">Continue with</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'View Gap Analysis', screen: 'competency-gap-analysis' },
                      { label: 'Simulate Growth', screen: 'competency-growth-simulation' },
                      { label: 'Learning Paths', screen: 'competency-learning-paths' },
                      { label: 'Role Transitions', screen: 'competency-role-transition' },
                    ].map(({ label, screen }) => (
                      <Button key={screen} variant="outline" size="sm" onClick={() => onNavigate(screen as Screen)} className="text-xs">
                        {label} <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
