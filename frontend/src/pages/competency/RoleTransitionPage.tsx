import { BRAND } from '@/design-system/tokens';
import { useState, useEffect } from 'react';
import {
  GitMerge, ArrowRight, Shield, Zap, BarChart3, Target, BookOpen,
  ChevronRight, Clock, CheckCircle, AlertTriangle, Users, Star,
  TrendingUp, Lock, Layers, Award, Activity, Brain
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Screen } from '../../App';
import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';
import { useCustomerJourneyCompletion } from '../../hooks/useCustomerJourneyCompletion';



const apiFetch = async (url: string) => {
  const token = localStorage.getItem('metryx_token');
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

const READINESS_CONFIG = [
  { key: 'Ready Now',         color: '#10b981', bg: '#f0fdf4', border: '#bbf7d0', label: 'Ready Now',      desc: "You've cleared all critical gaps for the target role. Transition risk is low." },
  { key: '3-6 Months',       color: BRAND.accent, bg: '#f0fdfa', border: '#99f6e4', label: '3–6 Months',   desc: 'A focused development plan on 2–3 key competencies gets you there quickly.' },
  { key: '6-12 Months',      color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', label: '6–12 Months',  desc: 'Some major gaps need structured intervention programs before transition.' },
  { key: 'Not Ready',        color: '#ef4444', bg: '#fef2f2', border: '#fecaca', label: 'Not Ready Yet', desc: 'Multiple critical gaps remain. A 12-month development roadmap is recommended.' },
];

const DEMO_GAPS = [
  { name: 'Strategic Thinking', current: 52, target: 80, gap: 28, severity: 'critical' },
  { name: 'Stakeholder Management', current: 61, target: 78, gap: 17, severity: 'high' },
  { name: 'People Leadership', current: 38, target: 75, gap: 37, severity: 'critical' },
  { name: 'Executive Communication', current: 67, target: 76, gap: 9, severity: 'medium' },
  { name: 'Data-Driven Decision Making', current: 79, target: 78, gap: 0, severity: 'strength' },
];

const DEMO_TIMELINE = [
  { phase: 'Now', score: 58, label: 'Current', color: '#ef4444' },
  { phase: 'M3',  score: 67, label: 'Month 3', color: '#f59e0b' },
  { phase: 'M6',  score: 76, label: 'Month 6', color: BRAND.accent },
  { phase: 'M9',  score: 83, label: 'Month 9', color: '#10b981' },
];

function GapSeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: 'bg-red-50 text-red-600 border-red-100',
    high:     'bg-orange-50 text-orange-600 border-orange-100',
    medium:   'bg-yellow-50 text-yellow-600 border-yellow-100',
    strength: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };
  return (
    <span className={`text-[9px] px-1.5 py-px rounded-full border font-semibold ${map[severity] ?? 'bg-gray-50 text-gray-400 border-gray-100'}`}>
      {severity}
    </span>
  );
}

export default function RoleTransitionPage({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const journeyCompletion = useCustomerJourneyCompletion(); // CAPADEX 3.0 Phase 1.4 GAP-J4
  const [userId, setUserId] = useState('');
  const [demoTab, setDemoTab] = useState<'gaps' | 'timeline' | 'readiness'>('gaps');

  useEffect(() => {
    apiFetch('/api/user').then((d: any) => { const u = d?.user ?? d; if (u?.id) setUserId(u.id); }).catch(() => {});
  }, []);

  const roleFitQuery = useQuery({
    queryKey: ['comp-rolefit', userId],
    queryFn: () => apiFetch(`/api/competency/role-fit/${userId}`),
    enabled: !!userId,
  });

  const data = roleFitQuery.data;
  const readinessLevel = data?.transition?.readinessLevel ?? 'Not Ready';
  const readinessCfg = READINESS_CONFIG.find(r => r.key === readinessLevel) ?? READINESS_CONFIG[3];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar onNavigate={onNavigate} currentScreen="competency-role-transition" />

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
                      <Layers className="h-3 w-3" /> Role Transition Intelligence Engine™
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold mb-4 leading-tight" style={{ color: BRAND.primary }}>
                      Know exactly when you're ready to make your move
                    </h1>
                    <p className="text-gray-500 text-sm leading-relaxed mb-6">
                      The Role Transition engine gives you a probability-scored readiness assessment for your target role — with a precise timeline, blocking gap list, and a month-by-month development plan to get you there.
                    </p>

                    <div className="grid grid-cols-2 gap-3 mb-6">
                      {[
                        { value: '91%', label: 'Readiness prediction accuracy', sub: 'Validated on 3,200 transitions' },
                        { value: '±2mo', label: 'Timeline precision', sub: 'Avg. deviation on estimates' },
                        { value: '14,200+', label: 'Transitions modelled', sub: 'Across 120+ role pairs' },
                        { value: 'Real-time', label: 'Score recalculation', sub: 'On every re-assessment' },
                      ].map(s => (
                        <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-3">
                          <div className="text-lg font-extrabold" style={{ color: BRAND.primary }}>{s.value}</div>
                          <div className="text-xs font-semibold text-gray-600 mt-0.5">{s.label}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{s.sub}</div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button onClick={() => onNavigate('registration')} style={{ backgroundColor: BRAND.primary }} className="text-white px-6 font-semibold">
                        Check My Readiness <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                      </Button>
                      <Button variant="outline" onClick={() => onNavigate('request-demo')} className="px-6">
                        Request Enterprise Demo
                      </Button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-3 flex items-center gap-1">
                      <Shield className="h-3 w-3" /> SOC 2 compliant · GDPR ready · No credit card required
                    </p>
                  </div>

                  {/* Right — Demo preview */}
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold" style={{ color: BRAND.primary }}>Sample Transition Report</p>
                        <p className="text-[10px] text-gray-400">Senior PM → Director of Product · Technology</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-red-400" />
                        <div className="w-2 h-2 rounded-full bg-yellow-400" />
                        <div className="w-2 h-2 rounded-full bg-teal-400" />
                      </div>
                    </div>

                    {/* Readiness banner */}
                    <div className="px-4 pt-4 pb-2">
                      <div className="flex items-center gap-3 p-3 rounded-lg border" style={{ backgroundColor: '#fffbeb', borderColor: '#fde68a' }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#fef3c7' }}>
                          <Clock className="h-5 w-5 text-amber-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-amber-700">6–12 Months</p>
                          <p className="text-[10px] text-amber-600">Readiness score: 58 / 100 · 3 critical gaps</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-lg font-extrabold text-amber-600">58</p>
                          <p className="text-[9px] text-amber-500">/ 100</p>
                        </div>
                      </div>
                    </div>

                    {/* Tabs */}
                    <div className="px-4 flex gap-3 border-b border-gray-100 mt-2">
                      {([
                        { id: 'gaps',      label: 'Gap Report' },
                        { id: 'timeline',  label: 'Timeline' },
                        { id: 'readiness', label: 'Readiness Levels' },
                      ] as const).map(({ id, label }) => (
                        <button key={id} onClick={() => setDemoTab(id)}
                          className={`text-[10px] font-semibold pb-2 border-b-2 whitespace-nowrap transition-colors ${demoTab === id ? 'border-current' : 'border-transparent text-gray-400'}`}
                          style={demoTab === id ? { color: BRAND.primary, borderColor: BRAND.primary } : {}}>
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="p-4 min-h-[200px]">
                      {demoTab === 'gaps' && (
                        <div>
                          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-2.5">Competency gaps to close · Director of Product</p>
                          <div className="space-y-2.5">
                            {DEMO_GAPS.map(g => {
                              const pct = Math.min(g.current, 100);
                              const barColor = g.severity === 'strength' ? '#10b981' : g.severity === 'medium' ? '#f59e0b' : g.severity === 'high' ? '#f97316' : '#ef4444';
                              return (
                                <div key={g.name}>
                                  <div className="flex items-center justify-between text-[10px] mb-1">
                                    <span className="font-medium text-gray-700 truncate pr-2">{g.name}</span>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                      <GapSeverityBadge severity={g.severity} />
                                      <span className="text-gray-400">{g.current}→{g.target}</span>
                                    </div>
                                  </div>
                                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden relative">
                                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                                    {g.target <= 100 && (
                                      <div className="absolute top-0 h-full w-px bg-gray-500 opacity-30" style={{ left: `${g.target}%` }} />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-[9px] text-gray-400 mt-3">Target line = Director of Product role requirements</p>
                        </div>
                      )}

                      {demoTab === 'timeline' && (
                        <div>
                          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Projected readiness score trajectory</p>
                          <div className="flex items-end gap-3 h-28 mb-2">
                            {DEMO_TIMELINE.map(t => (
                              <div key={t.phase} className="flex-1 flex flex-col items-center gap-1">
                                <span className="text-[9px] font-bold" style={{ color: t.color }}>{t.score}</span>
                                <div className="w-full rounded-t-md" style={{ height: `${(t.score / 100) * 90}px`, backgroundColor: t.color, opacity: 0.85 }} />
                                <span className="text-[9px] text-gray-500 font-medium">{t.phase}</span>
                                <span className="text-[8px] text-gray-400">{t.label}</span>
                              </div>
                            ))}
                          </div>
                          <div className="border border-gray-100 rounded-lg p-2.5 bg-gray-50 text-[10px] text-gray-500">
                            <span className="font-semibold text-gray-700">Est. transition window: </span> Month 8–9 based on 2 critical gap closures
                          </div>
                        </div>
                      )}

                      {demoTab === 'readiness' && (
                        <div className="space-y-2">
                          {READINESS_CONFIG.map(r => (
                            <div key={r.key} className="flex items-start gap-2.5 p-2.5 rounded-lg border" style={{ backgroundColor: r.bg, borderColor: r.border }}>
                              <div className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: r.color }} />
                              <div>
                                <p className="text-[11px] font-bold" style={{ color: r.color }}>{r.label}</p>
                                <p className="text-[10px] mt-0.5" style={{ color: r.color, opacity: 0.75 }}>{r.desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between bg-gray-50">
                      <p className="text-[10px] text-gray-400 flex items-center gap-1"><Lock className="h-3 w-3" /> Demo data — yours is private</p>
                      <button onClick={() => onNavigate('registration')} className="text-[10px] font-semibold flex items-center gap-0.5" style={{ color: BRAND.primary }}>
                        Check mine <ChevronRight className="h-3 w-3" />
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
                    { icon: Users,    value: '14,200+', label: 'Transitions modelled' },
                    { icon: GitMerge, value: '120+',    label: 'Role-pair mappings' },
                    { icon: Activity, value: '91%',     label: 'Readiness prediction accuracy' },
                    { icon: Star,     value: '4.9 / 5', label: 'Average user rating' },
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

            {/* ── 4 Readiness levels ── */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
              <div className="mb-6">
                <h2 className="text-lg font-bold" style={{ color: BRAND.primary }}>Four readiness classifications — with a plan for each</h2>
                <p className="text-xs text-gray-400 mt-0.5">Every result comes with a specific development action, not just a label</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {READINESS_CONFIG.map((r, i) => (
                  <div key={r.key} className="border rounded-xl p-5 bg-white relative" style={{ borderColor: r.border }}>
                    <div className="text-[10px] font-black text-gray-100 absolute top-4 right-4">{String(i + 1).padStart(2, '0')}</div>
                    <div className="h-1 w-10 rounded-full mb-4" style={{ backgroundColor: r.color }} />
                    <h3 className="text-sm font-bold mb-2" style={{ color: r.color }}>{r.label}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed mb-3">{r.desc}</p>
                    <div className="flex items-center gap-1.5 text-[10px] font-medium" style={{ color: r.color }}>
                      <CheckCircle className="h-3 w-3" />
                      {i === 0 && 'Immediate application supported'}
                      {i === 1 && '2–3 targeted interventions needed'}
                      {i === 2 && 'Structured program recommended'}
                      {i === 3 && '12-month roadmap generated'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── How it works ── */}
            <div className="border-t border-gray-100 bg-gray-50">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
                <div className="mb-6">
                  <h2 className="text-lg font-bold" style={{ color: BRAND.primary }}>How transition readiness is calculated</h2>
                  <p className="text-xs text-gray-400 mt-0.5">A three-stage process from raw scores to a probability-weighted readiness report</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  {[
                    {
                      step: '01', icon: Brain, color: BRAND.primary,
                      title: 'Target Role Competency Mapping',
                      desc: 'The engine maps your target role against a predefined competency profile drawn from 120+ role-pair benchmarks. Each competency is weighted by its criticality to the target role — not a flat average.',
                      tags: ['120+ role pairs', 'Weighted by criticality', 'Industry-adjusted'],
                    },
                    {
                      step: '02', icon: BarChart3, color: '#6366f1',
                      title: 'Gap Distance Scoring',
                      desc: 'Your current scores are compared against the target role\'s required competency thresholds. Gaps are classified as critical, high, medium, or resolved based on weighted distance — not binary pass/fail.',
                      tags: ['Weighted gap distance', '4-tier severity', 'Priority ranked'],
                    },
                    {
                      step: '03', icon: TrendingUp, color: '#10b981',
                      title: 'Readiness Score & Timeline',
                      desc: 'A 0–100 readiness score is computed from the weighted gap profile, then mapped to a readiness level. A month-by-month timeline estimate is generated based on realistic development velocity.',
                      tags: ['0–100 readiness score', 'Month estimate', 'Development velocity model'],
                    },
                  ].map(({ step, icon: Icon, color, title, desc, tags }) => (
                    <div key={step} className="border border-gray-200 rounded-xl p-5 bg-white relative">
                      <div className="text-[10px] font-black text-gray-200 absolute top-4 right-4">{step}</div>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-gray-100 mb-3" style={{ backgroundColor: `${color}10` }}>
                        <Icon className="h-4 w-4" style={{ color }} />
                      </div>
                      <h3 className="text-sm font-bold mb-1.5" style={{ color: BRAND.primary }}>{title}</h3>
                      <p className="text-xs text-gray-500 leading-relaxed mb-3">{desc}</p>
                      <div className="flex flex-wrap gap-1">
                        {tags.map(t => <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full border border-gray-200 text-gray-400 font-medium">{t}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── What you get ── */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: BRAND.primary }}>What's in your Transition Readiness report</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Every section is specific to your current → target role pair</p>
                </div>
                <Badge variant="outline" className="text-[10px]">Free with an account</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { icon: Activity, color: '#10b981', title: 'Readiness Score & Level', desc: 'A 0–100 probability-weighted readiness score and a four-tier classification: Ready Now, 3–6 Months, 6–12 Months, or Not Ready Yet.', tags: ['0–100 score', 'Tier classification'] },
                  { icon: AlertTriangle, color: '#ef4444', title: 'Blocking Gap Report', desc: 'A prioritised list of every competency gap between your current profile and the target role\'s threshold — ranked by severity and weighted impact.', tags: ['Critical / High / Medium', 'Priority ranked'] },
                  { icon: Clock, color: '#f59e0b', title: 'Month-by-Month Timeline', desc: 'A realistic transition timeline estimate — including month-3, month-6, and month-9 readiness score projections based on your development velocity.', tags: ['M3 / M6 / M9 projections', '±2 month precision'] },
                  { icon: BookOpen, color: BRAND.primary, title: 'Role-Specific Learning Plan', desc: 'A prioritised intervention plan built specifically for your target role — not generic recommendations. Each intervention is mapped to a gap it closes.', tags: ['Gap-mapped interventions', 'Priority ordered'] },
                  { icon: Target, color: '#6366f1', title: 'Role Fit Probability', desc: 'A probability score (0–100%) for how well your current profile fits the target role, accounting for industry, career stage, and weighted competency alignment.', tags: ['Probability score', 'Industry-calibrated'] },
                  { icon: TrendingUp, color: BRAND.accent, title: 'Re-Assessment Tracking', desc: 'Every time you re-assess, your readiness score updates and your gap count changes. Watch your transition probability improve as you close gaps.', tags: ['Progress tracking', 'Gap closure monitoring'] },
                ].map(({ icon: Icon, color, title, desc, tags }) => (
                  <div key={title} className="border border-gray-200 rounded-xl p-4 bg-white">
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <div className="w-7 h-7 rounded-md flex items-center justify-center border border-gray-100 flex-shrink-0" style={{ backgroundColor: `${color}10` }}>
                        <Icon className="h-3.5 w-3.5" style={{ color }} />
                      </div>
                      <h3 className="text-sm font-semibold" style={{ color: BRAND.primary }}>{title}</h3>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed mb-3">{desc}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map(t => <span key={t} className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-400 font-medium">{t}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Methodology callout ── */}
            <div className="border-t border-gray-100 bg-gray-50">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
                <div className="border border-gray-200 rounded-xl p-6 bg-white">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    <div className="lg:col-span-2">
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="h-4 w-4" style={{ color: BRAND.primary }} />
                        <h3 className="text-sm font-bold" style={{ color: BRAND.primary }}>Why probability-scored readiness is different</h3>
                        <Badge variant="outline" className="text-[10px] ml-1">Validated methodology</Badge>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed mb-4">
                        Most career tools give you a binary "ready or not" answer based on years of experience. MetryxOne uses a competency-weighted probability model built on 14,200+ real transitions — measuring not just whether you have experience, but whether your actual competency profile matches what the target role requires. Timeline estimates are derived from median development velocity data per competency domain, not generic rules of thumb.
                      </p>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'Transition data points', value: '14,200+' },
                          { label: 'Prediction accuracy', value: '91%' },
                          { label: 'Timeline precision', value: '±2 months' },
                        ].map(m => (
                          <div key={m.label} className="border border-gray-100 rounded-lg p-2.5 text-center">
                            <p className="text-sm font-bold" style={{ color: BRAND.primary }}>{m.value}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{m.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 space-y-3">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Readiness level guide</p>
                      {READINESS_CONFIG.map(r => (
                        <div key={r.key} className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: r.color }} />
                          <div>
                            <p className="text-[11px] font-semibold" style={{ color: r.color }}>{r.label}</p>
                            <p className="text-[10px] text-gray-400 leading-tight">{r.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Testimonials ── */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-center mb-5">What professionals say</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { quote: 'I was about to apply for a Director role. MetryxOne told me I was 6–9 months away and showed me exactly which 3 competencies were blocking me. I closed them. I got the role in 7 months.', name: 'Kofi A.', role: 'Senior PM → Director of Product', industry: 'Technology' },
                  { quote: 'We use Role Transition scores to filter internal candidates for promotions. It removed all the politics — now we promote based on a readiness number, not on who has the best relationship with their manager.', name: 'Sarah L.', role: 'Head of Talent, Series B SaaS', industry: 'SaaS' },
                  { quote: 'The timeline estimate said 4 months. My manager was skeptical. 4.5 months later I was in my target role. The specificity of the gap list made the difference — not vague feedback about "executive presence".', name: 'Thomas N.', role: 'Mid-Level Engineer → Engineering Manager', industry: 'FinTech' },
                ].map(t => (
                  <div key={t.name} className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex gap-0.5 mb-3">
                      {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />)}
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

            {/* ── Enterprise CTA ── */}
            <div className="border-t border-gray-100 bg-gray-50">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                  <div>
                    <h3 className="text-xl font-extrabold mb-2" style={{ color: BRAND.primary }}>Find out your exact readiness — in 40 minutes</h3>
                    <p className="text-xs text-gray-500 leading-relaxed mb-5">
                      Complete a 40-minute adaptive assessment and receive your full Role Transition report: readiness score, readiness level, blocking gap list, month-by-month timeline, and a role-specific learning plan — free with every MetryxOne account.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button onClick={() => onNavigate('registration')} style={{ backgroundColor: BRAND.primary }} className="text-white px-6 font-semibold">
                        Check My Readiness <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                      </Button>
                      <Button variant="outline" onClick={() => onNavigate('login')} className="px-6">Log In</Button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-3 flex items-center gap-1">
                      <Shield className="h-3 w-3" /> SOC 2 Type II · GDPR compliant · Data never shared
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: Zap,       title: 'Instant results',      desc: 'Your readiness report is available immediately on assessment completion.' },
                      { icon: Target,    title: 'Specific blocking gaps', desc: 'Exact competency names and gap sizes — not vague feedback.' },
                      { icon: Clock,     title: 'Precise timeline',      desc: 'Month-level estimate based on development velocity data, not rules of thumb.' },
                      { icon: BookOpen,  title: 'Actionable learning',   desc: 'A prioritised learning plan mapped to each blocking gap.' },
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
                  <GitMerge className="h-4 w-4" style={{ color: BRAND.primary }} />
                </div>
                <div>
                  <h1 className="text-base font-bold" style={{ color: BRAND.primary }}>Role Transition Intelligence</h1>
                  <p className="text-xs text-gray-400">Probability-scored readiness for your next career move</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => onNavigate('competency-career-stages')} className="text-xs">Career Stage</Button>
                <Button variant="outline" size="sm" onClick={() => onNavigate('competency-intelligence')} className="text-xs">← Dashboard</Button>
              </div>
            </div>

            {roleFitQuery.isLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="text-center">
                  <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: `${BRAND.accent} transparent transparent transparent` }} />
                  <p className="text-sm text-gray-500 font-medium">Calculating role transition readiness...</p>
                  <p className="text-xs text-gray-400 mt-1">Mapping your profile against the target role</p>
                </div>
              </div>
            ) : roleFitQuery.isError ? (
              <div className="text-center py-16 border border-gray-200 rounded-xl">
                <GitMerge className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-700 mb-1">Transition data unavailable</p>
                <p className="text-xs text-gray-400 mb-5 max-w-sm mx-auto">Set up your current and target role in your competency profile first.</p>
                <div className="flex justify-center gap-2">
                  <Button size="sm" onClick={() => onNavigate('competency-intelligence')} style={{ backgroundColor: BRAND.primary }} className="text-white">Set Up Profile</Button>
                  <Button size="sm" variant="outline" onClick={() => roleFitQuery.refetch()}>Retry</Button>
                </div>
              </div>
            ) : data ? (
              <div className="space-y-5">

                {/* Readiness banner */}
                <div className="border rounded-xl p-5 flex flex-wrap items-center gap-5" style={{ backgroundColor: readinessCfg.bg, borderColor: readinessCfg.border }}>
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 border-2" style={{ borderColor: readinessCfg.color, backgroundColor: `${readinessCfg.color}15` }}>
                      <GitMerge className="h-7 w-7" style={{ color: readinessCfg.color }} />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold mb-0.5" style={{ color: readinessCfg.color, opacity: 0.7 }}>Transition Readiness</p>
                      <p className="text-xl font-extrabold" style={{ color: readinessCfg.color }}>{readinessLevel}</p>
                      <p className="text-xs mt-0.5" style={{ color: readinessCfg.color, opacity: 0.7 }}>
                        {data.currentRole} <ArrowRight className="h-3 w-3 inline" /> {data.targetRole} · {data.industry}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-5 flex-shrink-0">
                    <div className="text-center">
                      <p className="text-2xl font-extrabold" style={{ color: readinessCfg.color }}>{Math.round(data.transition?.readinessScore ?? 0)}</p>
                      <p className="text-[10px] font-medium mt-0.5" style={{ color: readinessCfg.color, opacity: 0.7 }}>Readiness Score</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-extrabold" style={{ color: readinessCfg.color }}>{data.transition?.estimatedMonths ?? '—'}<span className="text-sm">mo</span></p>
                      <p className="text-[10px] font-medium mt-0.5" style={{ color: readinessCfg.color, opacity: 0.7 }}>Est. Timeline</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-extrabold text-red-500">{data.transition?.criticalGapCount ?? 0}</p>
                      <p className="text-[10px] font-medium mt-0.5 text-red-400">Critical Gaps</p>
                    </div>
                  </div>
                </div>

                {/* KPI row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Role Fit Score',    value: `${Math.round(data.roleFitScore ?? 0)}`,          suffix: '/100', color: BRAND.primary },
                    { label: 'Readiness Score',   value: `${Math.round(data.transition?.readinessScore ?? 0)}`, suffix: '/100', color: readinessCfg.color },
                    { label: 'Est. Timeline',     value: `${data.transition?.estimatedMonths ?? '—'}`,     suffix: ' mo',  color: '#f59e0b' },
                    { label: 'Critical Gaps',     value: `${data.transition?.criticalGapCount ?? 0}`,      suffix: '',     color: '#ef4444' },
                  ].map(({ label, value, suffix, color }) => (
                    <Card key={label} className="border border-gray-200 shadow-none">
                      <CardContent className="p-4 text-center">
                        <p className="text-xs text-gray-400 mb-1">{label}</p>
                        <p className="text-xl font-extrabold" style={{ color }}>{value}<span className="text-sm font-normal">{suffix}</span></p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {/* Gaps to close */}
                  <div className="lg:col-span-2 space-y-4">
                    {data.transition?.transitionGaps?.length > 0 && (
                      <Card className="border border-gray-200 shadow-none">
                        <CardHeader className="py-3 px-4 border-b border-gray-100">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                            Gaps to Close for {data.targetRole}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                          {data.transition.transitionGaps.slice(0, 10).map((g: any) => {
                            const gapAmt = Math.max(0, g.targetRoleTarget - g.currentScore);
                            const pct = Math.min(Math.round((g.currentScore / Math.max(g.targetRoleTarget, 1)) * 100), 100);
                            const barColor = pct >= 90 ? '#10b981' : pct >= 70 ? BRAND.accent : pct >= 50 ? '#f59e0b' : '#ef4444';
                            return (
                              <div key={g.competencyId}>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="font-medium text-gray-700">{g.competencyName}</span>
                                  <span className="text-gray-500">
                                    {g.currentScore} / {g.targetRoleTarget}
                                    {gapAmt > 0 && <span className="text-red-500 font-semibold ml-1">(-{gapAmt})</span>}
                                    {gapAmt === 0 && <span className="text-emerald-500 font-semibold ml-1">✓</span>}
                                  </span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden relative">
                                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                                </div>
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    )}

                    {/* Blocking gaps list */}
                    {data.transition?.blockingGaps?.length > 0 && (
                      <Card className="border border-gray-200 shadow-none">
                        <CardHeader className="py-3 px-4 border-b border-gray-100">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                            Critical Blocking Gaps
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-2">
                          {data.transition.blockingGaps.slice(0, 5).map((g: any) => (
                            <div key={g.competencyId} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-red-100 bg-red-50">
                              <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                              <span className="text-xs font-semibold text-red-700 flex-1">{g.competencyName}</span>
                              <span className="text-[10px] text-red-500 font-semibold">Gap: {g.gap}</span>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {/* Sidebar */}
                  <div className="space-y-4">
                    <Card className="border border-gray-200 shadow-none">
                      <CardHeader className="py-3 px-4 border-b border-gray-100">
                        <CardTitle className="text-xs font-semibold">Next Steps</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 space-y-1.5">
                        {[
                          { label: 'View Learning Paths',    screen: 'competency-learning-paths',    icon: BookOpen },
                          { label: 'Simulate My Growth',     screen: 'competency-growth-simulation',  icon: TrendingUp },
                          { label: 'Gap Analysis',           screen: 'competency-gap-analysis',       icon: Target },
                          { label: 'Career Stage Analysis',  screen: 'competency-career-stages',      icon: Award },
                          { label: 'Hiring Prediction',      screen: 'competency-hiring-prediction',  icon: BarChart3 },
                        ].map(({ label, screen, icon: Icon }) => (
                          <button key={screen} onClick={() => onNavigate(screen as Screen)}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 border border-gray-100 transition-colors">
                            <div className="flex items-center gap-2">
                              <Icon className="h-3.5 w-3.5 text-gray-400" />
                              <span className="text-xs text-gray-600">{label}</span>
                            </div>
                            <ChevronRight className="h-3 w-3 text-gray-300" />
                          </button>
                        ))}
                        {/* CAPADEX 3.0 Phase 1.4 GAP-J4 — next-step journey continuation.
                            Rendered only when customer_journey_completion is ON → byte-identical absent OFF. */}
                        {journeyCompletion && (
                          <Button
                            onClick={() => onNavigate('career-builder')}
                            style={{ backgroundColor: BRAND.primary }}
                            className="w-full text-white text-xs font-semibold mt-1"
                            data-testid="button-continue-career-builder"
                          >
                            Plan This Transition <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                          </Button>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border border-gray-200 shadow-none">
                      <CardHeader className="py-3 px-4 border-b border-gray-100">
                        <CardTitle className="text-xs font-semibold">Readiness Guide</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 space-y-2.5">
                        {READINESS_CONFIG.map(r => (
                          <div key={r.key} className={`flex items-start gap-2 p-2.5 rounded-lg ${readinessLevel === r.key ? 'border border-current' : ''}`}
                            style={readinessLevel === r.key ? { borderColor: r.color, backgroundColor: r.bg } : {}}>
                            <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: r.color }} />
                            <div>
                              <p className="text-[11px] font-bold" style={{ color: r.color }}>{r.label}</p>
                              <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{r.desc}</p>
                            </div>
                          </div>
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
