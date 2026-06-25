import { BRAND } from '@/design-system/tokens';
import { useState, useEffect } from 'react';
import {
  Rocket, ArrowRight, Shield, Zap, BarChart3, Target, BookOpen,
  ChevronRight, CheckCircle, Users, Star, TrendingUp, Lock,
  Layers, Award, Activity, Calendar, Clock, GitMerge, AlertTriangle
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

const WEEK_OPTIONS = [
  { value: '12', label: '3 Months' },
  { value: '24', label: '6 Months' },
  { value: '36', label: '9 Months' },
  { value: '52', label: '1 Year' },
];

const DEMO_DOMAINS = [
  { domain: 'Strategic Thinking', now: 52, m3: 63, m6: 74, m9: 80, y1: 85, color: '#6366f1' },
  { domain: 'People Leadership',  now: 38, m3: 50, m6: 62, m9: 70, y1: 76, color: '#ef4444' },
  { domain: 'Communication',      now: 71, m3: 76, m6: 80, m9: 83, y1: 85, color: BRAND.accent },
  { domain: 'Data Literacy',      now: 81, m3: 84, m6: 86, m9: 88, y1: 89, color: '#10b981' },
  { domain: 'Stakeholder Mgmt',   now: 61, m3: 69, m6: 75, m9: 79, y1: 82, color: '#f59e0b' },
];

const DEMO_INTERVENTIONS = [
  { name: 'Strategic Leadership Programme', competency: 'Strategic Thinking', weeks: 8,  gain: 22, type: 'Course',   priority: 'Critical' },
  { name: 'People Manager Bootcamp',         competency: 'People Leadership',  weeks: 10, gain: 24, type: 'Programme', priority: 'Critical' },
  { name: 'Executive Communication Skills',  competency: 'Communication',      weeks: 4,  gain: 9,  type: 'Course',   priority: 'High' },
  { name: 'Stakeholder Influence Workshop',  competency: 'Stakeholder Mgmt',   weeks: 3,  gain: 14, type: 'Workshop', priority: 'High' },
];

const DEMO_MILESTONES = [
  { month: 'Month 1–2', event: 'Start Strategic Thinking + Leadership interventions', score: 46, color: '#6366f1' },
  { month: 'Month 3',   event: 'Complete Communication course. Score reaches 67.', score: 67, color: BRAND.accent },
  { month: 'Month 5',   event: 'Leadership gaps substantially closed. Hiring score reaches Likely Hire.', score: 73, color: '#f59e0b' },
  { month: 'Month 6',   event: 'Target: Readiness score ≥75. Projected Director of Product role fit: 84%.', score: 79, color: '#10b981' },
];

type HorizonKey = 'now' | 'm3' | 'm6' | 'm9' | 'y1';

export default function GrowthSimulationPage({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const [userId, setUserId] = useState('');
  const [weeks, setWeeks] = useState('24');
  const [demoTab, setDemoTab] = useState<'trajectory' | 'interventions' | 'milestones'>('trajectory');
  const [demoHorizon, setDemoHorizon] = useState<HorizonKey>('m6');

  useEffect(() => {
    apiFetch('/api/user').then((d: any) => { const u = d?.user ?? d; if (u?.id) setUserId(u.id); }).catch(() => {});
  }, []);

  const simQuery = useQuery({
    queryKey: ['comp-growth', userId, weeks],
    queryFn: () => apiFetch(`/api/competency/simulate-growth/${userId}?weeks=${weeks}`),
    enabled: !!userId,
  });

  const data = simQuery.data;

  const horizonLabels: Record<HorizonKey, string> = { now: 'Now', m3: '3 Mo', m6: '6 Mo', m9: '9 Mo', y1: '1 Yr' };
  const horizons: HorizonKey[] = ['now', 'm3', 'm6', 'm9', 'y1'];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar onNavigate={onNavigate} currentScreen="competency-growth-simulation" />

      <main className="flex-1 pt-16">
        {!userId ? (
          <>
            {/* ── Hero ── */}
            <div className="border-b border-gray-100 bg-gray-50">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">

                  {/* Left */}
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border mb-4"
                      style={{ borderColor: BRAND.primary, color: BRAND.primary, backgroundColor: `${BRAND.primary}08` }}>
                      <Layers className="h-3 w-3" /> Growth Simulation Engine™
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold mb-4 leading-tight" style={{ color: BRAND.primary }}>
                      Simulate your competency growth before you do the work
                    </h1>
                    <p className="text-gray-500 text-sm leading-relaxed mb-6">
                      The Growth Simulation engine projects your competency trajectory across 3, 6, 9-month and 1-year horizons — modelled on real intervention durations, expected score gains, and gap priority order. See your future profile before you invest a single hour of development time.
                    </p>

                    <div className="grid grid-cols-2 gap-3 mb-6">
                      {[
                        { value: '4',      label: 'Time horizons',         sub: '3mo · 6mo · 9mo · 1yr' },
                        { value: 'Domain', label: 'Level projections',     sub: 'Per-domain trajectories' },
                        { value: 'Gap-',   label: 'Priority sequencing',   sub: 'Critical gaps tackled first' },
                        { value: 'Real',   label: 'Intervention durations', sub: 'Based on actual course data' },
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
                        Simulate My Growth <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                      </Button>
                      <Button variant="outline" onClick={() => onNavigate('request-demo')} className="px-6">
                        Request Enterprise Demo
                      </Button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-3 flex items-center gap-1">
                      <Shield className="h-3 w-3" /> SOC 2 compliant · GDPR ready · No credit card required
                    </p>
                  </div>

                  {/* Right — interactive demo */}
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold" style={{ color: BRAND.primary }}>Sample Growth Simulation</p>
                        <p className="text-[10px] text-gray-400">Senior PM → Director of Product · Technology</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-red-400" />
                        <div className="w-2 h-2 rounded-full bg-yellow-400" />
                        <div className="w-2 h-2 rounded-full bg-teal-400" />
                      </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-gray-100 bg-gray-50">
                      {([
                        { id: 'trajectory',   label: 'Trajectory' },
                        { id: 'interventions',label: 'Interventions' },
                        { id: 'milestones',   label: 'Milestones' },
                      ] as const).map(({ id, label }) => (
                        <button key={id} onClick={() => setDemoTab(id)}
                          className={`flex-1 py-2 text-[10px] font-semibold border-b-2 transition-colors ${demoTab === id ? 'border-current bg-white' : 'border-transparent text-gray-400'}`}
                          style={demoTab === id ? { color: BRAND.primary, borderColor: BRAND.primary } : {}}>
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="p-4 min-h-[290px]">
                      {demoTab === 'trajectory' && (
                        <div>
                          {/* Horizon selector */}
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide">Domain scores by horizon</p>
                            <div className="flex gap-1">
                              {horizons.map(h => (
                                <button key={h} onClick={() => setDemoHorizon(h)}
                                  className={`text-[9px] px-1.5 py-0.5 rounded-full border font-semibold transition-colors ${demoHorizon === h ? 'text-white border-current' : 'text-gray-400 border-gray-200'}`}
                                  style={demoHorizon === h ? { backgroundColor: BRAND.primary, borderColor: BRAND.primary } : {}}>
                                  {horizonLabels[h]}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2.5">
                            {DEMO_DOMAINS.map(d => {
                              const score = d[demoHorizon];
                              const gain = score - d.now;
                              const barColor = score >= 75 ? '#10b981' : score >= 55 ? BRAND.accent : '#f59e0b';
                              return (
                                <div key={d.domain}>
                                  <div className="flex items-center justify-between text-[10px] mb-1">
                                    <span className="font-medium text-gray-700">{d.domain}</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-gray-400">Now: {d.now}</span>
                                      <ArrowRight className="h-2.5 w-2.5 text-gray-300" />
                                      <span className="font-bold" style={{ color: barColor }}>{score}</span>
                                      {gain > 0 && <span className="text-emerald-500 font-semibold text-[9px]">+{gain}</span>}
                                    </div>
                                  </div>
                                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
                                    <div className="h-full rounded-l-full" style={{ width: `${d.now}%`, backgroundColor: `${d.color}50` }} />
                                    {gain > 0 && (
                                      <div className="h-full rounded-r-full" style={{ width: `${gain}%`, backgroundColor: barColor }} />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex items-center gap-3 mt-3 text-[9px] text-gray-400">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-gray-200" /> Current score</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-emerald-400" /> Projected gain</span>
                          </div>
                        </div>
                      )}

                      {demoTab === 'interventions' && (
                        <div>
                          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-2.5">Planned interventions · sequenced by priority</p>
                          <div className="space-y-2">
                            {DEMO_INTERVENTIONS.map((iv, i) => {
                              const priStyle: Record<string, string> = {
                                Critical: 'bg-red-50 text-red-600 border-red-100',
                                High:     'bg-orange-50 text-orange-600 border-orange-100',
                              };
                              const typeColor: Record<string, string> = { Course: '#6366f1', Programme: BRAND.primary, Workshop: '#f59e0b' };
                              return (
                                <div key={iv.name} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100">
                                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                                    style={{ backgroundColor: typeColor[iv.type] ?? BRAND.primary }}>{i + 1}</div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-semibold text-gray-700 truncate">{iv.name}</p>
                                    <p className="text-[9px] text-gray-400">{iv.competency} · {iv.weeks}w · {iv.type}</p>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <p className="text-xs font-bold text-emerald-600">+{iv.gain}</p>
                                    <span className={`text-[9px] px-1.5 py-px rounded-full border font-semibold ${priStyle[iv.priority]}`}>{iv.priority}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-[9px] text-gray-400 mt-3 flex items-center gap-1">
                            <Zap className="h-2.5 w-2.5" /> Total projected gain across all interventions: <b className="text-emerald-600 ml-0.5">+69 pts</b>
                          </p>
                        </div>
                      )}

                      {demoTab === 'milestones' && (
                        <div>
                          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Growth milestones · 6-month plan</p>
                          <div className="relative pl-4">
                            <div className="absolute left-2 top-2 bottom-2 w-px bg-gray-200" />
                            <div className="space-y-4">
                              {DEMO_MILESTONES.map((m) => (
                                <div key={m.month} className="flex gap-3 relative">
                                  <div className="w-3 h-3 rounded-full border-2 border-white flex-shrink-0 mt-0.5 relative z-10 -ml-1.5"
                                    style={{ backgroundColor: m.color }} />
                                  <div>
                                    <p className="text-[10px] font-bold" style={{ color: m.color }}>{m.month}</p>
                                    <p className="text-[10px] text-gray-500 leading-relaxed mt-0.5">{m.event}</p>
                                    <p className="text-[9px] font-semibold text-gray-400 mt-1">Readiness score: {m.score}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                      <p className="text-[10px] text-gray-400 flex items-center gap-1"><Lock className="h-3 w-3" /> Demo data — your simulation is private</p>
                      <button onClick={() => onNavigate('registration')} className="text-[10px] font-semibold flex items-center gap-0.5" style={{ color: BRAND.primary }}>
                        Run mine <ChevronRight className="h-3 w-3" />
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
                    { icon: Users,    value: '14,200+', label: 'Simulations run' },
                    { icon: Calendar, value: '4',       label: 'Time horizons' },
                    { icon: Activity, value: 'Domain',  label: 'Level projections' },
                    { icon: Star,     value: '4.9 / 5', label: 'User satisfaction' },
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

            {/* ── How simulation works ── */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
              <div className="mb-6">
                <h2 className="text-lg font-bold" style={{ color: BRAND.primary }}>How the simulation is modelled</h2>
                <p className="text-xs text-gray-400 mt-0.5">Not aspirational projections — modelled on real intervention data and observed development velocity</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {[
                  {
                    step: '01', icon: Target, color: BRAND.primary,
                    title: 'Gap-Priority Sequencing',
                    desc: 'The engine sequences interventions starting with critical-severity gaps — the ones with the highest weighted impact on your role-fit and hiring scores. Critical gaps are addressed in weeks 1–12 by default.',
                    tags: ['Critical-first ordering', 'Weighted impact', 'Customisable sequence'],
                  },
                  {
                    step: '02', icon: BookOpen, color: '#6366f1',
                    title: 'Real Intervention Durations',
                    desc: 'Growth is not modelled on arbitrary percentages. Each intervention has a duration in weeks drawn from actual course completion data, and an expected score gain derived from observed outcomes across 14,200+ learners.',
                    tags: ['Actual course durations', 'Observed score gains', '14,200+ data points'],
                  },
                  {
                    step: '03', icon: TrendingUp, color: '#10b981',
                    title: 'Domain-Level Trajectories',
                    desc: 'Projections are generated at the competency-domain level — not just overall score. You can see exactly which domains will improve the fastest and track progress across 3, 6, 9-month, and 1-year horizons.',
                    tags: ['10 domain projections', '4 time horizons', 'Score breakdown'],
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

            {/* ── What you get ── */}
            <div className="border-t border-gray-100 bg-gray-50">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: BRAND.primary }}>What's in your Growth Simulation report</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Runs instantly from your assessment data — re-run it any time you re-assess</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">Free with an account</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { icon: TrendingUp,    color: '#10b981', title: 'Multi-Horizon Score Projection',    desc: 'Your overall competency score projected at 3, 6, 9 months and 1 year — with domain-level breakdowns at each horizon.',                   tags: ['4 time horizons', 'Domain-level'] },
                    { icon: BarChart3,     color: BRAND.primary, title: 'Domain Trajectory Charts',      desc: 'Visual growth bars for each competency domain showing current score, intervention gain, and projected end-state — per selected horizon.',  tags: ['10 domains', 'Visual bars'] },
                    { icon: Zap,          color: '#f59e0b', title: 'Prioritised Intervention Sequence', desc: 'A ranked intervention plan — ordered by gap severity and score impact — showing what to do first for maximum score lift in minimum time.', tags: ['Gap-priority ordered', 'Max lift sequencing'] },
                    { icon: Calendar,     color: '#6366f1', title: 'Month-by-Month Milestones',         desc: 'A milestone timeline showing which interventions complete at which months and what readiness or hiring score threshold they unlock.',        tags: ['Timeline view', 'Score milestones'] },
                    { icon: Clock,        color: BRAND.accent, title: 'Time-to-Target Estimate',         desc: 'The engine calculates how many months until your competency profile reaches your target role\'s required threshold score.',                tags: ['Target threshold', 'Month estimate'] },
                    { icon: Rocket,       color: '#ec4899', title: 'Scenario Comparison',               desc: 'Compare what happens if you focus on critical gaps only vs. a balanced approach vs. doubling intervention hours per week.',                tags: ['3 scenarios', 'Side-by-side compare'] },
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
            </div>

            {/* ── Methodology callout ── */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
              <div className="border border-gray-200 rounded-xl p-6 bg-white">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  <div className="lg:col-span-2">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="h-4 w-4" style={{ color: BRAND.primary }} />
                      <h3 className="text-sm font-bold" style={{ color: BRAND.primary }}>Why this simulation is different from generic learning projections</h3>
                      <Badge variant="outline" className="text-[10px] ml-1">Evidence-based</Badge>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed mb-4">
                      Most development plans tell you to "take a leadership course" without quantifying the expected score impact, the time required, or the order in which to tackle gaps. MetryxOne's simulation uses observed score gains from 14,200+ learners who completed specific interventions — mapped to the interventions' actual duration in weeks. The output is a realistic, time-sequenced projection rather than a motivational aspiration.
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Data points used',     value: '14,200+' },
                        { label: 'Intervention types',   value: '3 types' },
                        { label: 'Projection horizons',  value: '4 horizons' },
                      ].map(m => (
                        <div key={m.label} className="border border-gray-100 rounded-lg p-2.5 text-center">
                          <p className="text-sm font-bold" style={{ color: BRAND.primary }}>{m.value}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{m.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 space-y-3">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Intervention types modelled</p>
                    {[
                      { type: 'Course',    desc: 'Self-paced or instructor-led. 4–12 weeks. Typical gain: 8–25 pts.', color: '#6366f1' },
                      { type: 'Programme', desc: 'Structured multi-week programme. 8–16 weeks. Typical gain: 18–30 pts.', color: BRAND.primary },
                      { type: 'Workshop',  desc: 'Intensive short-form. 1–4 weeks. Typical gain: 5–15 pts.', color: '#f59e0b' },
                    ].map(iv => (
                      <div key={iv.type} className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: iv.color }} />
                        <div>
                          <p className="text-[11px] font-semibold" style={{ color: iv.color }}>{iv.type}</p>
                          <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{iv.desc}</p>
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
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-center mb-5">What practitioners say</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { quote: 'I\'d been stuck in the same role for two years telling myself I wasn\'t ready. The simulation showed me I was 4 months away if I focused on two competencies. I did. I made the move in 3.5 months.', name: 'Amara L.', role: 'Mid-Level PM → Senior PM', industry: 'SaaS' },
                    { quote: 'We use the growth simulation in all IDPs now. Instead of vague development goals, each team member has a score projection and a sequenced intervention plan. Manager conversations are 10× more productive.', name: 'Chris D.', role: 'Director, Learning & Development', industry: 'Financial Services' },
                    { quote: 'The intervention sequence was key. I was about to take a random leadership course. The engine told me my stakeholder management was the bottleneck — not leadership. Closed the right gap. Got the promotion.', name: 'Yuki N.', role: 'Senior Engineer → Engineering Manager', industry: 'Technology' },
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
            </div>

            {/* ── CTA ── */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div>
                  <h3 className="text-xl font-extrabold mb-2" style={{ color: BRAND.primary }}>See your growth trajectory before you invest the time</h3>
                  <p className="text-xs text-gray-500 leading-relaxed mb-5">
                    Complete your competency assessment and run your personalised 6-month growth simulation — with domain-level projections, a prioritised intervention sequence, and a month-by-month milestone timeline. Free with every MetryxOne account.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={() => onNavigate('registration')} style={{ backgroundColor: BRAND.primary }} className="text-white px-6 font-semibold">
                      Simulate My Growth <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                    </Button>
                    <Button variant="outline" onClick={() => onNavigate('login')} className="px-6">Log In</Button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-3 flex items-center gap-1">
                    <Shield className="h-3 w-3" /> SOC 2 Type II · GDPR compliant · Data never sold
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Clock,     title: '4 horizons',       desc: '3-month, 6-month, 9-month, and 1-year projections in one report' },
                    { icon: Zap,       title: 'Gap-first order',  desc: 'Critical competency gaps are addressed before lower-priority ones' },
                    { icon: BookOpen,  title: 'Real durations',   desc: 'Modelled on actual intervention completion times, not guesses' },
                    { icon: TrendingUp,title: 'Re-run anytime',   desc: 'Simulation updates every time you re-assess — track real progress' },
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
          </>
        ) : (
          /* ── Authenticated View ── */
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

            {/* Page header */}
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-gray-200" style={{ backgroundColor: `${BRAND.primary}08` }}>
                  <Rocket className="h-4 w-4" style={{ color: BRAND.primary }} />
                </div>
                <div>
                  <h1 className="text-base font-bold" style={{ color: BRAND.primary }}>Growth Simulation</h1>
                  <p className="text-xs text-gray-400">Projected competency growth trajectory over time</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select value={weeks} onValueChange={setWeeks}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEK_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => onNavigate('competency-intelligence')} className="text-xs">← Dashboard</Button>
              </div>
            </div>

            {simQuery.isLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="text-center">
                  <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: `${BRAND.accent} transparent transparent transparent` }} />
                  <p className="text-sm text-gray-500 font-medium">Running growth simulation...</p>
                  <p className="text-xs text-gray-400 mt-1">Sequencing interventions and projecting trajectories</p>
                </div>
              </div>
            ) : simQuery.isError ? (
              <div className="text-center py-16 border border-gray-200 rounded-xl">
                <Rocket className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-700 mb-1">Simulation unavailable</p>
                <p className="text-xs text-gray-400 mb-5 max-w-sm mx-auto">Ensure your competency profile and assessment scores are configured before running a simulation.</p>
                <div className="flex justify-center gap-2">
                  <Button size="sm" onClick={() => onNavigate('competency-intelligence')} style={{ backgroundColor: BRAND.primary }} className="text-white">Go to Dashboard</Button>
                  <Button size="sm" variant="outline" onClick={() => simQuery.refetch()}>Retry</Button>
                </div>
              </div>
            ) : data ? (
              <div className="space-y-5">

                {/* KPI row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Starting Score',   value: Math.round(data.startingScore ?? 0),   suffix: '/100', color: '#6b7280' },
                    { label: `Projected (${WEEK_OPTIONS.find(o => o.value === weeks)?.label})`, value: Math.round(data.projectedScore ?? 0), suffix: '/100', color: BRAND.accent },
                    { label: 'Score Gain',        value: `+${Math.round((data.projectedScore ?? 0) - (data.startingScore ?? 0))}`, suffix: ' pts', color: '#10b981' },
                    { label: 'Interventions',     value: data.interventions?.length ?? 0,         suffix: ' planned', color: BRAND.primary },
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
                  <div className="lg:col-span-2 space-y-4">

                    {/* Trajectory chart */}
                    {data.weeklyProjections?.length > 0 && (
                      <Card className="border border-gray-200 shadow-none">
                        <CardHeader className="py-3 px-4 border-b border-gray-100">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <TrendingUp className="h-3.5 w-3.5" style={{ color: BRAND.accent }} />
                            Growth Trajectory — {WEEK_OPTIONS.find(o => o.value === weeks)?.label}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                          <div className="relative h-36 flex items-end gap-0.5">
                            {data.weeklyProjections.map((point: any, i: number) => {
                              const maxScore = Math.max(...data.weeklyProjections.map((p: any) => p.projectedScore), 100);
                              const heightPct = (point.projectedScore / maxScore) * 100;
                              const isFirst = i === 0;
                              const isLast = i === data.weeklyProjections.length - 1;
                              return (
                                <div key={i} className="flex-1 rounded-t-sm transition-all duration-500"
                                  style={{
                                    height: `${heightPct}%`,
                                    backgroundColor: isFirst ? '#e5e7eb' : isLast ? '#10b981' : BRAND.accent,
                                    opacity: isFirst ? 0.4 : 0.65 + (i / data.weeklyProjections.length) * 0.35,
                                  }}
                                  title={`Week ${point.week}: ${Math.round(point.projectedScore)}`} />
                              );
                            })}
                          </div>
                          <div className="flex justify-between text-[10px] text-gray-400 mt-1.5">
                            <span>Week 1</span>
                            <span>Week {Math.round(parseInt(weeks) / 2)}</span>
                            <span>Week {weeks}</span>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Interventions */}
                    {data.interventions?.length > 0 && (
                      <Card className="border border-gray-200 shadow-none">
                        <CardHeader className="py-3 px-4 border-b border-gray-100">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Zap className="h-3.5 w-3.5 text-amber-500" />
                            Planned Interventions — Priority Sequenced
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-2">
                          {data.interventions.slice(0, 8).map((iv: any, i: number) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                                style={{ backgroundColor: BRAND.primary }}>{i + 1}</div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-gray-800">{iv.competencyName ?? iv.competencyId}</p>
                                <p className="text-[10px] text-gray-400">Duration: {iv.durationWeeks}w · Expected gain: +{iv.expectedScoreGain} pts</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-sm font-bold text-emerald-600">+{iv.expectedScoreGain}</p>
                                <p className="text-[10px] text-gray-400">{iv.durationWeeks}w</p>
                              </div>
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
                        <CardTitle className="text-xs font-semibold">Quick Actions</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 space-y-1.5">
                        {[
                          { label: 'Start Learning Plan',   screen: 'competency-learning-paths',   icon: BookOpen },
                          { label: 'View My Gaps',          screen: 'competency-gap-analysis',     icon: Target },
                          { label: 'Role Transition',       screen: 'competency-role-transition',  icon: GitMerge },
                          { label: 'Hiring Prediction',     screen: 'competency-hiring-prediction',icon: Award },
                          { label: 'Career Stage',          screen: 'competency-career-stages',    icon: TrendingUp },
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
                      </CardContent>
                    </Card>

                    <Card className="border border-gray-200 shadow-none">
                      <CardHeader className="py-3 px-4 border-b border-gray-100">
                        <CardTitle className="text-xs font-semibold">Simulation Summary</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 space-y-2">
                        {[
                          { label: 'Horizon', value: WEEK_OPTIONS.find(o => o.value === weeks)?.label ?? '—' },
                          { label: 'Starting score', value: `${Math.round(data.startingScore ?? 0)} / 100` },
                          { label: 'Projected score', value: `${Math.round(data.projectedScore ?? 0)} / 100` },
                          { label: 'Total gain', value: `+${Math.round((data.projectedScore ?? 0) - (data.startingScore ?? 0))} pts` },
                          { label: 'Active interventions', value: `${data.interventions?.length ?? 0}` },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex items-center justify-between text-xs py-1 border-b border-gray-50 last:border-0">
                            <span className="text-gray-400">{label}</span>
                            <span className="font-semibold text-gray-700">{value}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    {data.interventions?.length > 0 && (
                      <Card className="border border-amber-100 bg-amber-50 shadow-none">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-semibold text-amber-800 mb-1">Tip: Start with intervention #1</p>
                              <p className="text-[10px] text-amber-700 leading-relaxed">The sequence is optimised for maximum score lift. Begin with the top-ranked intervention for the fastest improvement to your role-fit score.</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
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
