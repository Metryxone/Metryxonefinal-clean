import { BRAND } from '@/design-system/tokens';
import { useState, useEffect } from 'react';
import {
  Target, AlertTriangle, CheckCircle, TrendingUp, ArrowRight,
  BarChart3, Shield, Zap, Users, BookOpen, Clock, Star,
  ChevronRight, Info, Award, Lock
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Screen } from '../../App';
import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';



const apiFetch = async (url: string) => {
  const token = localStorage.getItem('metryx_token');
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

const GAP_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  critical: { bg: '#fef2f2', text: '#b91c1c', border: '#fca5a5', label: 'Critical' },
  high:     { bg: '#fff7ed', text: '#c2410c', border: '#fdba74', label: 'High' },
  medium:   { bg: '#fefce8', text: '#854d0e', border: '#fde047', label: 'Medium' },
  low:      { bg: '#eff6ff', text: '#1d4ed8', border: '#93c5fd', label: 'Low' },
  strength: { bg: '#f0fdf4', text: '#15803d', border: '#86efac', label: 'Strength' },
};

const DEMO_GAPS = [
  { name: 'Strategic Thinking', domain: 'Leadership', userScore: 52, targetScore: 78, gapLevel: 'critical', gap: 26, weight: 0.94 },
  { name: 'Data-Driven Decision Making', domain: 'Analytics', userScore: 61, targetScore: 82, gapLevel: 'high', gap: 21, weight: 0.88 },
  { name: 'Executive Communication', domain: 'Communication', userScore: 67, targetScore: 85, gapLevel: 'high', gap: 18, weight: 0.85 },
  { name: 'Change Management', domain: 'Organisational', userScore: 58, targetScore: 74, gapLevel: 'medium', gap: 16, weight: 0.72 },
  { name: 'Stakeholder Alignment', domain: 'Influence', userScore: 63, targetScore: 76, gapLevel: 'medium', gap: 13, weight: 0.68 },
];

const DEMO_STRENGTHS = [
  { name: 'Team Leadership', domain: 'Leadership', userScore: 88, targetScore: 74, surplus: 14 },
  { name: 'Project Delivery', domain: 'Execution', userScore: 91, targetScore: 78, surplus: 13 },
  { name: 'Technical Depth', domain: 'Engineering', userScore: 85, targetScore: 74, surplus: 11 },
];

function GapBar({ userScore, targetScore, demo = false }: { userScore: number; targetScore: number; demo?: boolean }) {
  const userPct = Math.min(userScore, 100);
  const targetPct = Math.min(targetScore, 100);
  const gap = Math.max(0, targetPct - userPct);
  return (
    <div className={`relative w-full h-2 bg-gray-100 rounded-full overflow-hidden${demo ? ' opacity-80' : ''}`}>
      <div className="absolute inset-y-0 left-0 rounded-full transition-all" style={{ width: `${userPct}%`, backgroundColor: BRAND.accent }} />
      {gap > 0 && (
        <div className="absolute inset-y-0 rounded-full" style={{ left: `${userPct}%`, width: `${gap}%`, backgroundColor: 'rgba(239,68,68,0.18)', borderRight: '2px solid #ef4444' }} />
      )}
      <div className="absolute inset-y-0 top-0 w-px bg-gray-400 opacity-40" style={{ left: `${targetPct}%` }} />
    </div>
  );
}

function ReadinessRing({ score }: { score: number }) {
  const r = 44, circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f97316' : '#ef4444';
  return (
    <svg width="110" height="110" viewBox="0 0 110 110" className="rotate-[-90deg]">
      <circle cx="55" cy="55" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
      <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round" />
      <text x="55" y="62" textAnchor="middle" className="rotate-[90deg]" style={{ fill: BRAND.primary, fontSize: 22, fontWeight: 800, transform: 'rotate(90deg)', transformOrigin: '55px 55px' }}>
        {score}
      </text>
    </svg>
  );
}

export default function GapAnalysisPage({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const [userId, setUserId] = useState('');
  const [activeTab, setActiveTab] = useState<'gaps' | 'strengths' | 'recommendations'>('gaps');

  useEffect(() => {
    apiFetch('/api/user').then((d: any) => { const u = d?.user ?? d; if (u?.id) setUserId(u.id); }).catch(() => {});
  }, []);

  const gapQuery = useQuery({
    queryKey: ['comp-gap', userId],
    queryFn: () => apiFetch(`/api/competency/gap-analysis/${userId}`),
    enabled: !!userId,
  });

  // Role library: resolves the user's target role to the bigger O*NET-backed
  // competency library so roles outside the legacy hardcoded set still surface
  // their required competencies. Read-only and honest — an unresolved role or a
  // role with no ratings returns a `note` rather than fabricated requirements.
  const roleLibQuery = useQuery({
    queryKey: ['comp-role-library', userId],
    queryFn: () => apiFetch(`/api/competency/role-library/${userId}`),
    enabled: !!userId,
  });
  const roleLib = roleLibQuery.data?.data;

  const data = gapQuery.data;
  const readinessScore = data ? Math.max(0, 100 - ((data.summary?.critical ?? 0) * 12 + (data.summary?.high ?? 0) * 6)) : 0;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar onNavigate={onNavigate} currentScreen="competency-gap-analysis" />

      <main className="flex-1 pt-16">
        {!userId ? (
          <>
            {/* ── Hero ── */}
            <div className="border-b border-gray-100 bg-gray-50">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                  {/* Left copy */}
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border mb-4" style={{ borderColor: BRAND.primary, color: BRAND.primary, backgroundColor: `${BRAND.primary}08` }}>
                      <Target className="h-3 w-3" /> Gap Analysis & Role Fit Engine™
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold mb-4 leading-tight" style={{ color: BRAND.primary }}>
                      Know exactly which competencies are holding you back
                    </h1>
                    <p className="text-gray-500 text-sm leading-relaxed mb-6">
                      MetryxOne's Gap Analysis Engine maps your competency profile against real industry cohort benchmarks — surfacing the precise gaps between where you are and where your target role requires you to be, ranked by weighted priority.
                    </p>
                    <div className="grid grid-cols-3 gap-3 mb-6">
                      {[
                        { value: '50', label: 'Competencies measured' },
                        { value: 'P75', label: 'Cohort benchmark' },
                        { value: '7', label: 'Industries covered' },
                      ].map(s => (
                        <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                          <div className="text-xl font-extrabold" style={{ color: BRAND.primary }}>{s.value}</div>
                          <div className="text-[10px] text-gray-400 font-medium mt-0.5 leading-tight">{s.label}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button onClick={() => onNavigate('registration')} style={{ backgroundColor: BRAND.primary }} className="text-white px-6 font-semibold">
                        Analyse My Gaps Free <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                      </Button>
                      <Button variant="outline" onClick={() => onNavigate('request-demo')} className="px-6">
                        Request Enterprise Demo
                      </Button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-3 flex items-center gap-1">
                      <Shield className="h-3 w-3" /> No credit card required · SOC 2 compliant · GDPR ready
                    </p>
                  </div>

                  {/* Right — Demo report preview */}
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold" style={{ color: BRAND.primary }}>Sample Gap Report</p>
                        <p className="text-[10px] text-gray-400">Senior Product Manager · Technology</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-red-400" />
                        <div className="w-2 h-2 rounded-full bg-yellow-400" />
                        <div className="w-2 h-2 rounded-full bg-teal-400" />
                      </div>
                    </div>

                    {/* Summary chips */}
                    <div className="px-4 pt-3 pb-2 grid grid-cols-4 gap-2 border-b border-gray-100">
                      {[
                        { label: 'Critical', value: '2', color: '#ef4444' },
                        { label: 'High', value: '3', color: '#f97316' },
                        { label: 'Medium', value: '4', color: '#854d0e' },
                        { label: 'Strengths', value: '3', color: '#10b981' },
                      ].map(s => (
                        <div key={s.label} className="text-center">
                          <p className="text-base font-extrabold" style={{ color: s.color }}>{s.value}</p>
                          <p className="text-[9px] text-gray-400">{s.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Demo gaps */}
                    <div className="p-4 space-y-3">
                      {DEMO_GAPS.slice(0, 4).map(g => {
                        const c = GAP_COLORS[g.gapLevel];
                        return (
                          <div key={g.name} className="rounded-md p-2.5 border" style={{ backgroundColor: c.bg, borderColor: c.border }}>
                            <div className="flex items-center justify-between mb-1.5">
                              <div>
                                <p className="text-[11px] font-semibold" style={{ color: c.text }}>{g.name}</p>
                                <p className="text-[9px] text-gray-400">{g.domain}</p>
                              </div>
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full" style={{ backgroundColor: c.border, color: c.text }}>{c.label}</span>
                            </div>
                            <GapBar userScore={g.userScore} targetScore={g.targetScore} demo />
                            <div className="flex justify-between mt-1 text-[9px] text-gray-400">
                              <span>You: <strong style={{ color: c.text }}>{g.userScore}</strong></span>
                              <span>Target P75: <strong>{g.targetScore}</strong></span>
                              <span>Gap: <strong style={{ color: c.text }}>–{g.gap}</strong></span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between bg-gray-50">
                      <p className="text-[10px] text-gray-400 flex items-center gap-1"><Lock className="h-3 w-3" /> Your full report is private</p>
                      <button onClick={() => onNavigate('registration')} className="text-[10px] font-semibold flex items-center gap-0.5" style={{ color: BRAND.primary }}>
                        View mine <ChevronRight className="h-3 w-3" />
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
                    { icon: Users, value: '14,200+', label: 'Professionals assessed' },
                    { icon: Award, value: '93%', label: 'Role-fit prediction accuracy' },
                    { icon: BarChart3, value: '50', label: 'Competencies per report' },
                    { icon: Star, value: '4.9 / 5', label: 'Average user rating' },
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

            {/* ── How it works ── */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: BRAND.primary }}>How the Gap Analysis Engine works</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Three steps from assessment to actionable intelligence</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {[
                  {
                    step: '01', icon: Zap, color: BRAND.primary,
                    title: 'Adaptive Assessment',
                    desc: 'Complete a 50-competency adaptive assessment calibrated to your industry. Responses are scored using IRT (Item Response Theory) for maximum precision — no generic quizzes.',
                    detail: 'Takes 25–35 minutes · Adaptive scoring',
                  },
                  {
                    step: '02', icon: BarChart3, color: BRAND.accent,
                    title: 'Cohort Benchmarking',
                    desc: 'Your scores are benchmarked against the P75 of verified professionals in the same role, industry, and career stage — not generic averages.',
                    detail: 'Live cohort data · Role-weighted',
                  },
                  {
                    step: '03', icon: Target, color: '#10b981',
                    title: 'Prioritised Gap Report',
                    desc: 'Gaps are ranked by a weighted priority index combining role-importance, gap magnitude, and development velocity — so you focus on what moves the needle.',
                    detail: 'Priority-ranked · Actionable paths',
                  },
                ].map(({ step, icon: Icon, color, title, desc, detail }) => (
                  <div key={step} className="border border-gray-200 rounded-xl p-5 relative bg-white">
                    <div className="text-[10px] font-black text-gray-200 absolute top-4 right-4">{step}</div>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-gray-100 mb-3" style={{ backgroundColor: `${color}10` }}>
                      <Icon className="h-4 w-4" style={{ color }} />
                    </div>
                    <h3 className="text-sm font-bold mb-1.5" style={{ color: BRAND.primary }}>{title}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed mb-3">{desc}</p>
                    <div className="flex items-center gap-1 text-[10px] font-medium text-gray-400">
                      <Clock className="h-3 w-3" /> {detail}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Feature deep-dive ── */}
            <div className="border-t border-gray-100 bg-gray-50">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: BRAND.primary }}>What's inside your gap report</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Enterprise-grade intelligence, individual-level precision</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">Free with an account</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    {
                      icon: AlertTriangle, color: '#ef4444',
                      title: 'Critical Gap Detection',
                      desc: 'Competencies where you fall below the P75 cohort benchmark by more than 15 points. Flagged as highest-priority interventions.',
                      tags: ['P75 threshold', 'Ranked by priority'],
                    },
                    {
                      icon: TrendingUp, color: BRAND.primary,
                      title: 'Weighted Priority Index',
                      desc: 'Each gap is multiplied by its role-importance weight sourced from industry job data, so you focus on what hiring managers actually care about.',
                      tags: ['Role-specific weights', 'JD-aligned'],
                    },
                    {
                      icon: CheckCircle, color: '#10b981',
                      title: 'Competitive Strengths Map',
                      desc: 'Competencies where you exceed the benchmark — your differentiators for interviews, promotions, and role negotiations.',
                      tags: ['Surplus scores', 'Positioning insights'],
                    },
                    {
                      icon: BarChart3, color: BRAND.accent,
                      title: 'Domain-Level Heatmap',
                      desc: 'Aggregate view across 10 competency domains — see at a glance which domains need the most work and which are already solid.',
                      tags: ['10 domains', 'Visual breakdown'],
                    },
                    {
                      icon: BookOpen, color: '#8b5cf6',
                      title: 'Learning Recommendations',
                      desc: 'Top-ranked learning interventions matched to your critical gaps, estimated by development velocity and time-to-impact.',
                      tags: ['Curated paths', 'Time estimates'],
                    },
                    {
                      icon: Users, color: '#f97316',
                      title: 'Cohort Percentile Rank',
                      desc: 'Know where you rank overall within your industry cohort — from the 1st to the 99th percentile — across all 50 competencies.',
                      tags: ['Live cohort', 'Percentile scoring'],
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
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  <div className="lg:col-span-2">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="h-4 w-4" style={{ color: BRAND.primary }} />
                      <h3 className="text-sm font-bold" style={{ color: BRAND.primary }}>Benchmark Methodology</h3>
                      <Badge variant="outline" className="text-[10px] ml-1">Peer-reviewed</Badge>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed mb-4">
                      Our benchmarks are constructed using verified assessment data from professionals who have completed onboarding assessments in partner organisations. Each competency benchmark is maintained at the <strong>P75 level</strong> — meaning the score at which 75% of high-performing incumbents in that role fall below. This sets a realistic but aspirational target that correlates strongly with performance ratings and promotion velocity.
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Benchmark cohort size', value: '8,400+' },
                        { label: 'Validation cycle', value: 'Quarterly' },
                        { label: 'Statistical method', value: 'IRT + P75' },
                      ].map(m => (
                        <div key={m.label} className="border border-gray-100 rounded-lg p-2.5 text-center">
                          <p className="text-sm font-bold" style={{ color: BRAND.primary }}>{m.value}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{m.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Strengths from demo</p>
                    {DEMO_STRENGTHS.map(s => (
                      <div key={s.name} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                        <div>
                          <p className="text-xs font-medium text-gray-700">{s.name}</p>
                          <p className="text-[10px] text-gray-400">{s.domain}</p>
                        </div>
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">+{s.surplus}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Testimonial strip ── */}
            <div className="border-t border-gray-100 bg-gray-50">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-center mb-5">What professionals say</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    {
                      quote: 'Finally a tool that tells me exactly which skills matter for my target role — not a generic skills list. The weighted priority ranking changed how I plan my development.',
                      name: 'Aisha K.', role: 'Senior PM → Director', industry: 'FinTech',
                    },
                    {
                      quote: 'The gap report was the most useful document I brought to my performance review. My manager had no idea I had benchmarked myself against industry P75.',
                      name: 'Marcus T.', role: 'Engineering Lead', industry: 'SaaS',
                    },
                    {
                      quote: 'We run MetryxOne gap analyses as part of our internal talent mobility process. The domain-level heatmap alone saves our L&D team weeks of manual assessment.',
                      name: 'Priya R.', role: 'VP People', industry: 'Healthcare Technology',
                    },
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
                    <h3 className="text-xl font-extrabold mb-2" style={{ color: BRAND.primary }}>Ready to close your competency gaps?</h3>
                    <p className="text-xs text-gray-500 leading-relaxed mb-5">
                      Get your full Gap Analysis report in under 40 minutes. Includes priority-ranked gaps, strengths map, cohort percentile rank, and personalised learning recommendations — free with every account.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button onClick={() => onNavigate('registration')} style={{ backgroundColor: BRAND.primary }} className="text-white px-6 font-semibold">
                        Get My Free Gap Report <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                      </Button>
                      <Button variant="outline" onClick={() => onNavigate('login')} className="px-6">
                        Log In
                      </Button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-3 flex items-center gap-1">
                      <Shield className="h-3 w-3" /> SOC 2 Type II · GDPR compliant · Data never shared
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: Zap, title: 'Instant results', desc: 'Report generated immediately after assessment completion.' },
                      { icon: Shield, title: 'Private by default', desc: 'Your gap report is visible only to you. Share on your terms.' },
                      { icon: TrendingUp, title: 'Track over time', desc: 'Re-assess quarterly and watch your gaps close in real time.' },
                      { icon: BookOpen, title: 'Learning paths included', desc: 'Each gap comes with a recommended development intervention.' },
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
                  <Target className="h-4 w-4" style={{ color: BRAND.primary }} />
                </div>
                <div>
                  <h1 className="text-base font-bold" style={{ color: BRAND.primary }}>Gap Analysis & Role Fit</h1>
                  <p className="text-xs text-gray-400">Competency gaps vs. industry benchmarks for your target role</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => onNavigate('competency-learning-paths')} className="text-xs">
                  View Learning Paths
                </Button>
                <Button variant="outline" size="sm" onClick={() => onNavigate('competency-intelligence')} className="text-xs">
                  ← Dashboard
                </Button>
              </div>
            </div>

            {gapQuery.isLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="text-center">
                  <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: `${BRAND.accent} transparent transparent transparent` }} />
                  <p className="text-sm text-gray-500 font-medium">Analysing your competency gaps...</p>
                  <p className="text-xs text-gray-400 mt-1">Benchmarking against your industry cohort</p>
                </div>
              </div>
            ) : gapQuery.isError ? (
              <div className="text-center py-16 border border-gray-200 rounded-xl">
                <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-700 mb-1">Gap analysis unavailable</p>
                <p className="text-xs text-gray-400 mb-5 max-w-sm mx-auto">Make sure your profile, target role, and industry are configured before running gap analysis.</p>
                <div className="flex justify-center gap-2">
                  <Button size="sm" onClick={() => onNavigate('competency-intelligence')} style={{ backgroundColor: BRAND.primary }} className="text-white">Set Up Profile</Button>
                  <Button size="sm" variant="outline" onClick={() => gapQuery.refetch()}>Try Again</Button>
                </div>
              </div>
            ) : data ? (
              <div className="space-y-5">
                {/* Summary row with readiness ring */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                  {/* Readiness score */}
                  <div className="lg:col-span-1 border border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center bg-white">
                    <ReadinessRing score={readinessScore} />
                    <p className="text-xs font-semibold mt-2" style={{ color: BRAND.primary }}>Role Readiness</p>
                    <p className="text-[10px] text-gray-400">{data.targetRole}</p>
                  </div>

                  {/* KPI cards */}
                  <div className="lg:col-span-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Critical Gaps', value: data.summary?.critical ?? 0, sub: 'Immediate action', color: '#ef4444', bg: '#fef2f2' },
                      { label: 'High Priority', value: data.summary?.high ?? 0, sub: 'Address this quarter', color: '#f97316', bg: '#fff7ed' },
                      { label: 'Medium Priority', value: data.summary?.medium ?? 0, sub: 'Plan ahead', color: '#854d0e', bg: '#fefce8' },
                      { label: 'Strengths', value: data.strengths?.length ?? 0, sub: 'Above benchmark', color: '#10b981', bg: '#f0fdf4' },
                    ].map(({ label, value, sub, color, bg }) => (
                      <div key={label} className="border border-gray-200 rounded-xl p-4 flex flex-col" style={{ backgroundColor: bg + '40' }}>
                        <p className="text-2xl font-extrabold mb-0.5" style={{ color }}>{value}</p>
                        <p className="text-xs font-semibold text-gray-700">{label}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Role library — required competencies from the bigger O*NET-backed library */}
                <Card className="border border-gray-200 shadow-none">
                  <CardHeader className="py-3 px-4 border-b border-gray-100">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Award className="h-3.5 w-3.5" style={{ color: BRAND.primary }} />
                        Required Competencies for Your Target Role
                      </CardTitle>
                      {roleLib?.resolved && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400">
                            {roleLib.resolved.title}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {roleLib.resolved.source === 'onet' ? 'O*NET data' : 'Curated library'}
                          </Badge>
                          {roleLib.counts?.total > 0 && (
                            <Badge variant="outline" className="text-[10px]">
                              {roleLib.counts.total} competencies
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    {roleLibQuery.isLoading ? (
                      <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                        <div className="w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${BRAND.accent} transparent transparent transparent` }} />
                        Resolving your role against the competency library...
                      </div>
                    ) : !roleLib || !roleLib.resolved || (roleLib.requiredCompetencies?.length ?? 0) === 0 ? (
                      <div className="flex items-start gap-2 rounded-lg bg-gray-50 border border-gray-100 p-3">
                        <Info className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-gray-500 leading-relaxed">
                          {roleLib?.note ?? 'Add a target role to your profile to see the competencies it requires.'}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {roleLib.requiredCompetencies.map((c: any) => {
                          const isCore = c.importanceTier === 'core';
                          return (
                            <div key={c.code} className="rounded-lg border border-gray-200 p-3">
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <div>
                                  <p className="text-xs font-semibold text-gray-700">{c.name}</p>
                                  {c.category && <p className="text-[10px] text-gray-400">{c.category}</p>}
                                </div>
                                <span
                                  className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full whitespace-nowrap"
                                  style={isCore
                                    ? { backgroundColor: `${BRAND.primary}15`, color: BRAND.primary }
                                    : { backgroundColor: '#f1f5f9', color: '#64748b' }}
                                >
                                  {isCore ? 'Core' : 'Secondary'}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-500">
                                <span>Weight: <strong className="text-gray-700">{c.weight}</strong></span>
                                {(c.minProficiency || c.targetProficiency) && (
                                  <span>
                                    Proficiency:{' '}
                                    <strong className="text-gray-700">
                                      {c.minProficiency ?? '—'} → {c.targetProficiency ?? '—'}
                                    </strong>
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Tabs */}
                <div className="flex items-center gap-1 border-b border-gray-100">
                  {([
                    { key: 'gaps', label: 'Priority Gaps', count: data.gaps?.length },
                    { key: 'strengths', label: 'Strengths', count: data.strengths?.length },
                    { key: 'recommendations', label: 'Recommendations', count: data.topRecommendations?.length },
                  ] as const).map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${activeTab === tab.key ? 'border-current' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                      style={activeTab === tab.key ? { color: BRAND.primary, borderColor: BRAND.primary } : {}}
                    >
                      {tab.label}
                      {tab.count != null && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: activeTab === tab.key ? `${BRAND.primary}15` : '#f1f5f9', color: activeTab === tab.key ? BRAND.primary : '#94a3b8' }}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  <div className="lg:col-span-2">
                    {activeTab === 'gaps' && (
                      <Card className="border border-gray-200 shadow-none">
                        <CardHeader className="py-3 px-4 border-b border-gray-100">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                            Priority Gaps — {data.targetRole}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                          {data.gaps?.length === 0 && (
                            <div className="text-center py-8">
                              <CheckCircle className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                              <p className="text-sm font-semibold text-gray-700">No significant gaps found</p>
                              <p className="text-xs text-gray-400 mt-1">You meet or exceed the benchmark across all measured competencies.</p>
                            </div>
                          )}
                          {data.gaps?.slice(0, 15).map((gap: any) => {
                            const c = GAP_COLORS[gap.gapLevel] ?? GAP_COLORS.low;
                            return (
                              <div key={gap.competencyId} className="rounded-lg p-3 border" style={{ backgroundColor: c.bg, borderColor: c.border }}>
                                <div className="flex items-center justify-between mb-2">
                                  <div>
                                    <p className="text-xs font-semibold" style={{ color: c.text }}>{gap.competencyName}</p>
                                    <p className="text-[10px] text-gray-400">{gap.domainName}</p>
                                  </div>
                                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: c.border, color: c.text }}>{c.label}</span>
                                </div>
                                <GapBar userScore={gap.userScore} targetScore={gap.targetScore} />
                                <div className="flex justify-between mt-1.5 text-[10px] text-gray-500">
                                  <span>Your score: <strong style={{ color: c.text }}>{gap.userScore}</strong></span>
                                  <span>Target P75: <strong>{gap.targetScore}</strong></span>
                                  <span>Gap: <strong style={{ color: c.text }}>–{gap.gap}</strong></span>
                                </div>
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    )}

                    {activeTab === 'strengths' && (
                      <Card className="border border-gray-200 shadow-none">
                        <CardHeader className="py-3 px-4 border-b border-gray-100">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                            Competitive Strengths — Above benchmark
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-2">
                          {data.strengths?.length === 0 && (
                            <p className="text-xs text-gray-400 text-center py-6">Complete your assessment to reveal your strengths.</p>
                          )}
                          {data.strengths?.map((s: any) => (
                            <div key={s.competencyId} className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                              <div>
                                <p className="text-xs font-semibold text-emerald-800">{s.competencyName}</p>
                                <p className="text-[10px] text-emerald-600">{s.domainName}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-extrabold text-emerald-600">+{Math.abs(s.gap)}</p>
                                <p className="text-[10px] text-emerald-500">above P75</p>
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {activeTab === 'recommendations' && (
                      <Card className="border border-gray-200 shadow-none">
                        <CardHeader className="py-3 px-4 border-b border-gray-100">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <BookOpen className="h-3.5 w-3.5 text-blue-500" />
                            Personalised Learning Recommendations
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                          {(!data.topRecommendations || data.topRecommendations.length === 0) && (
                            <p className="text-xs text-gray-400 text-center py-6">Recommendations will appear once your assessment is complete.</p>
                          )}
                          {data.topRecommendations?.map((r: any) => (
                            <div key={r.competencyId} className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                              <div className="flex items-start justify-between mb-1">
                                <p className="text-xs font-semibold text-blue-800">{r.title}</p>
                                <span className="text-[10px] text-blue-500 font-medium ml-2 whitespace-nowrap">{r.durationWeeks}w</span>
                              </div>
                              <p className="text-[10px] text-blue-600">{r.competencyName}</p>
                              {r.description && <p className="text-[10px] text-blue-500 mt-1 leading-relaxed">{r.description}</p>}
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {/* Sidebar — always visible */}
                  <div className="space-y-4">
                    {/* Gap severity breakdown */}
                    <Card className="border border-gray-200 shadow-none">
                      <CardHeader className="py-3 px-4 border-b border-gray-100">
                        <CardTitle className="text-xs font-semibold flex items-center gap-2">
                          <BarChart3 className="h-3.5 w-3.5 text-gray-400" /> Gap Severity Breakdown
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 space-y-2.5">
                        {[
                          { label: 'Critical', key: 'critical', color: '#ef4444' },
                          { label: 'High', key: 'high', color: '#f97316' },
                          { label: 'Medium', key: 'medium', color: '#854d0e' },
                          { label: 'Low', key: 'low', color: '#1d4ed8' },
                        ].map(({ label, key, color }) => {
                          const val = data.summary?.[key] ?? 0;
                          const total = (data.summary?.critical ?? 0) + (data.summary?.high ?? 0) + (data.summary?.medium ?? 0) + (data.summary?.low ?? 0);
                          const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                          return (
                            <div key={key}>
                              <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                                <span>{label}</span><span className="font-semibold">{val}</span>
                              </div>
                              <div className="h-1.5 bg-gray-100 rounded-full">
                                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>

                    {/* Quick actions */}
                    <Card className="border border-gray-200 shadow-none">
                      <CardHeader className="py-3 px-4 border-b border-gray-100">
                        <CardTitle className="text-xs font-semibold">Quick Actions</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 space-y-1.5">
                        {[
                          { label: 'View Learning Paths', screen: 'competency-learning-paths', icon: BookOpen },
                          { label: 'Industry Benchmarks', screen: 'competency-benchmarks', icon: BarChart3 },
                          { label: 'Growth Simulation', screen: 'competency-growth-simulation', icon: TrendingUp },
                          { label: 'Career Stage View', screen: 'competency-career-stages', icon: Award },
                        ].map(({ label, screen, icon: Icon }) => (
                          <button
                            key={screen}
                            onClick={() => onNavigate(screen as Screen)}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 border border-gray-100 transition-colors text-left"
                          >
                            <div className="flex items-center gap-2">
                              <Icon className="h-3.5 w-3.5 text-gray-400" />
                              <span className="text-xs text-gray-600">{label}</span>
                            </div>
                            <ChevronRight className="h-3 w-3 text-gray-300" />
                          </button>
                        ))}
                      </CardContent>
                    </Card>
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
