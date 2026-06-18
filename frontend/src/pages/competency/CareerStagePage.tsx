import { useState, useEffect } from 'react';
import {
  TrendingUp, Award, Users, Star, ArrowRight, Shield, Zap,
  BarChart3, Target, BookOpen, ChevronRight, Clock, CheckCircle,
  AlertTriangle, Lock, Layers
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Screen } from '../../App';
import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';

const BRAND = { primary: '#344E86', accent: '#4ECDC4' };

const apiFetch = async (url: string) => {
  const token = localStorage.getItem('metryx_token');
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

const STAGES = [
  { key: 'junior', label: 'Junior', color: '#6366f1', desc: '0–2 years experience', expectation: 'Foundation skills, learning velocity, task execution under guidance.' },
  { key: 'mid',    label: 'Mid-Level', color: BRAND.accent, desc: '2–5 years experience', expectation: 'Independent delivery, domain depth, peer collaboration and mentoring.' },
  { key: 'senior', label: 'Senior', color: '#f59e0b', desc: '5–10 years experience', expectation: 'Cross-functional influence, architectural thinking, stakeholder management.' },
  { key: 'lead',   label: 'Lead / Principal', color: '#10b981', desc: '10+ years or people leadership', expectation: 'Strategic vision, org-level impact, executive presence, people leadership.' },
];

const DEMO_FACTORS = [
  { label: 'Strategic Thinking', score: 52, weight: 'High' },
  { label: 'Technical Depth', score: 84, weight: 'High' },
  { label: 'Communication', score: 71, weight: 'Medium' },
  { label: 'People Leadership', score: 38, weight: 'High' },
  { label: 'Stakeholder Influence', score: 63, weight: 'Medium' },
  { label: 'Execution & Delivery', score: 89, weight: 'Low' },
];

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] font-bold w-6 text-right" style={{ color }}>{score}</span>
    </div>
  );
}

function StageProgressTrack({ current }: { current: string }) {
  const idx = STAGES.findIndex(s => s.key === current);
  return (
    <div className="flex items-center gap-0 w-full">
      {STAGES.map((s, i) => (
        <div key={s.key} className="flex items-center flex-1">
          <div className="flex flex-col items-center flex-shrink-0">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 text-[10px] font-bold transition-all ${i <= idx ? 'text-white border-current' : 'text-gray-300 border-gray-200 bg-white'}`}
              style={i <= idx ? { backgroundColor: s.color, borderColor: s.color } : {}}>
              {i < idx ? <CheckCircle className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <p className="text-[9px] font-semibold mt-1 whitespace-nowrap" style={{ color: i <= idx ? s.color : '#cbd5e1' }}>{s.label}</p>
          </div>
          {i < STAGES.length - 1 && (
            <div className="flex-1 h-0.5 mx-1" style={{ backgroundColor: i < idx ? STAGES[i].color : '#e2e8f0' }} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function CareerStagePage({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const [userId, setUserId] = useState('');
  const [demoStage, setDemoStage] = useState('mid');

  useEffect(() => {
    apiFetch('/api/user').then((d: any) => { const u = d?.user ?? d; if (u?.id) setUserId(u.id); }).catch(() => {});
  }, []);

  const roleFitQuery = useQuery({
    queryKey: ['comp-rolefit', userId],
    queryFn: () => apiFetch(`/api/competency/role-fit/${userId}`),
    enabled: !!userId,
  });

  const benchQuery = useQuery({
    queryKey: ['comp-benchmark', userId],
    queryFn: () => apiFetch(`/api/competency/get-percentile/${userId}`),
    enabled: !!userId,
  });

  const data = roleFitQuery.data;
  const benchData = benchQuery.data;
  const stageKey = data?.careerStage ?? 'mid';
  const stageInfo = STAGES.find(s => s.key === stageKey) ?? STAGES[1];
  const demoStageInfo = STAGES.find(s => s.key === demoStage) ?? STAGES[1];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar onNavigate={onNavigate} currentScreen="competency-career-stages" />

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
                      <Layers className="h-3 w-3" /> Career Stage Analysis Engine™
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold mb-4 leading-tight" style={{ color: BRAND.primary }}>
                      Benchmarked fairly for your exact career level
                    </h1>
                    <p className="text-gray-500 text-sm leading-relaxed mb-6">
                      Competency expectations shift dramatically at every career stage. A Senior Engineer isn't judged against a Junior's baseline — and neither are you. MetryxOne's Career Stage Engine calibrates every benchmark, gap, and score to your exact career level, so your analysis is always fair, precise, and actionable.
                    </p>
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      {[
                        { value: '4', label: 'Career stages tracked' },
                        { value: '50', label: 'Stage-calibrated skills' },
                        { value: 'Dynamic', label: 'Stage reclassification' },
                        { value: 'Real-time', label: 'Progress tracking' },
                      ].map(s => (
                        <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                          <div className="text-lg font-extrabold" style={{ color: BRAND.primary }}>{s.value}</div>
                          <div className="text-[10px] text-gray-400 font-medium mt-0.5 leading-tight">{s.label}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button onClick={() => onNavigate('registration')} style={{ backgroundColor: BRAND.primary }} className="text-white px-6 font-semibold">
                        See My Stage Analysis <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                      </Button>
                      <Button variant="outline" onClick={() => onNavigate('request-demo')} className="px-6">
                        Request Enterprise Demo
                      </Button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-3 flex items-center gap-1">
                      <Shield className="h-3 w-3" /> SOC 2 compliant · GDPR ready · No credit card required
                    </p>
                  </div>

                  {/* Right — Demo stage card */}
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold" style={{ color: BRAND.primary }}>Sample Stage Analysis</p>
                        <p className="text-[10px] text-gray-400">Product Manager · Technology</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-red-400" />
                        <div className="w-2 h-2 rounded-full bg-yellow-400" />
                        <div className="w-2 h-2 rounded-full bg-teal-400" />
                      </div>
                    </div>

                    {/* Stage selector tabs */}
                    <div className="px-4 pt-3 pb-0 flex gap-2 border-b border-gray-100">
                      {STAGES.map(s => (
                        <button
                          key={s.key}
                          onClick={() => setDemoStage(s.key)}
                          className={`text-[10px] font-semibold pb-2 border-b-2 whitespace-nowrap transition-colors px-1 ${demoStage === s.key ? 'border-current' : 'border-transparent text-gray-400'}`}
                          style={demoStage === s.key ? { color: s.color, borderColor: s.color } : {}}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>

                    <div className="p-4">
                      {/* Stage badge */}
                      <div className="flex items-center gap-3 mb-4 p-3 rounded-lg border" style={{ backgroundColor: `${demoStageInfo.color}08`, borderColor: `${demoStageInfo.color}30` }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${demoStageInfo.color}15` }}>
                          <Award className="h-4 w-4" style={{ color: demoStageInfo.color }} />
                        </div>
                        <div>
                          <p className="text-xs font-bold" style={{ color: demoStageInfo.color }}>{demoStageInfo.label}</p>
                          <p className="text-[10px] text-gray-400">{demoStageInfo.desc}</p>
                        </div>
                        <div className="ml-auto text-right">
                          <p className="text-lg font-extrabold" style={{ color: demoStageInfo.color }}>
                            {demoStage === 'junior' ? 41 : demoStage === 'mid' ? 67 : demoStage === 'senior' ? 79 : 85}
                          </p>
                          <p className="text-[9px] text-gray-400">Role Fit</p>
                        </div>
                      </div>

                      {/* Factor bars */}
                      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Stage-calibrated factors</p>
                      <div className="space-y-2">
                        {DEMO_FACTORS.slice(0, 5).map(f => {
                          const adjusted = demoStage === 'junior' ? Math.max(20, f.score - 30) : demoStage === 'senior' ? Math.min(100, f.score + 10) : demoStage === 'lead' ? Math.min(100, f.score + 15) : f.score;
                          const color = adjusted >= 75 ? '#10b981' : adjusted >= 55 ? BRAND.accent : adjusted >= 35 ? '#f59e0b' : '#ef4444';
                          return (
                            <div key={f.label}>
                              <div className="flex justify-between text-[9px] text-gray-500 mb-0.5">
                                <span>{f.label}</span>
                                <span className="font-semibold" style={{ color }}>{adjusted}</span>
                              </div>
                              <ScoreBar score={adjusted} color={color} />
                            </div>
                          );
                        })}
                      </div>
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
                    { icon: Layers, value: '4', label: 'Career stages tracked' },
                    { icon: Users, value: '14,200+', label: 'Professionals assessed' },
                    { icon: BarChart3, value: '50', label: 'Stage-calibrated skills' },
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

            {/* ── 4 Stages ── */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: BRAND.primary }}>Four career stages, four calibrated benchmarks</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Every stage has distinct competency expectations — your analysis reflects that</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {STAGES.map((s, i) => (
                  <div key={s.key} className="border border-gray-200 rounded-xl p-4 bg-white relative">
                    <div className="absolute top-3 right-3 text-[10px] font-black text-gray-100">{String(i + 1).padStart(2, '0')}</div>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: `${s.color}12` }}>
                      <Award className="h-4 w-4" style={{ color: s.color }} />
                    </div>
                    <h3 className="text-sm font-bold mb-0.5" style={{ color: s.color }}>{s.label}</h3>
                    <p className="text-[10px] text-gray-400 mb-2">{s.desc}</p>
                    <p className="text-[11px] text-gray-600 leading-relaxed">{s.expectation}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── How stage calibration works ── */}
            <div className="border-t border-gray-100 bg-gray-50">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: BRAND.primary }}>How stage calibration works</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Your benchmarks are never one-size-fits-all</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  {[
                    {
                      step: '01', icon: Zap, color: BRAND.primary,
                      title: 'Automatic Stage Detection',
                      desc: 'Based on your years of experience, current role, and assessment responses, the engine classifies your career stage dynamically — no manual selection needed.',
                      detail: 'Adaptive classification · Updated on each assessment',
                    },
                    {
                      step: '02', icon: BarChart3, color: BRAND.accent,
                      title: 'Stage-Specific P75 Benchmarks',
                      desc: 'Each stage has its own P75 cohort benchmark per competency. A Senior P75 is different from a Junior P75 — you\'re never unfairly compared across levels.',
                      detail: 'Per-stage P75 · Role and industry adjusted',
                    },
                    {
                      step: '03', icon: TrendingUp, color: '#10b981',
                      title: 'Stage Transition Readiness',
                      desc: 'The engine calculates your readiness to move to the next stage — showing your readiness score, timeline estimate, and the specific gaps blocking your promotion.',
                      detail: 'Promotion readiness · Time-to-stage estimate',
                    },
                  ].map(({ step, icon: Icon, color, title, desc, detail }) => (
                    <div key={step} className="border border-gray-200 rounded-xl p-5 bg-white relative">
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
            </div>

            {/* ── What you get ── */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: BRAND.primary }}>What's in your Career Stage report</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Every insight is calibrated to your exact level</p>
                </div>
                <Badge variant="outline" className="text-[10px]">Free with an account</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { icon: Award, color: '#6366f1', title: 'Current Stage Classification', desc: 'Automatic detection of your career stage (Junior / Mid / Senior / Lead) based on experience, role, and assessment performance.', tags: ['Dynamic detection', 'Role-aware'] },
                  { icon: Target, color: BRAND.primary, title: 'Stage-Calibrated Gap Report', desc: 'Competency gaps measured against the P75 of professionals at your exact career stage — not a general average.', tags: ['Per-stage P75', 'Priority ranked'] },
                  { icon: TrendingUp, color: '#10b981', title: 'Promotion Readiness Score', desc: 'A 0–100 score showing how ready you are to advance to the next career stage, with specific blocking gaps identified.', tags: ['Readiness score', 'Promotion timeline'] },
                  { icon: Clock, color: '#f59e0b', title: 'Time-to-Stage Estimate', desc: 'Based on your current gaps and typical development velocity, the engine estimates how many months until you\'re ready to level up.', tags: ['Month estimate', 'Gap-weighted'] },
                  { icon: BarChart3, color: BRAND.accent, title: 'Stage Factor Breakdown', desc: 'A breakdown of the key competency factors driving your stage score — weighted by their importance at your career level.', tags: ['Weighted factors', 'Stage-specific'] },
                  { icon: BookOpen, color: '#ec4899', title: 'Stage-Appropriate Learning', desc: 'Learning recommendations filtered and ranked for professionals at your exact stage — not generic content lists.', tags: ['Stage-filtered', 'Priority matched'] },
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
                      {tags.map(t => (
                        <span key={t} className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-400 font-medium">{t}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Why it matters callout ── */}
            <div className="border-t border-gray-100 bg-gray-50">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
                <div className="border border-gray-200 rounded-xl p-6 bg-white">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    <div className="lg:col-span-2">
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="h-4 w-4" style={{ color: BRAND.primary }} />
                        <h3 className="text-sm font-bold" style={{ color: BRAND.primary }}>Why stage calibration matters</h3>
                        <Badge variant="outline" className="text-[10px] ml-1">Research-backed</Badge>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed mb-4">
                        Most competency frameworks apply identical benchmarks to everyone — comparing a first-year analyst against a 15-year director. This creates systematically unfair assessments that undermine confidence and misdirect development effort. MetryxOne's stage-calibrated approach uses cohort data from 14,200+ professionals segmented by career stage, role, and industry — ensuring your gaps and strengths are only ever compared against professionals at your exact level.
                      </p>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'Stage cohort size', value: '3,500+' },
                          { label: 'Detection accuracy', value: '91%' },
                          { label: 'Recalibration cycle', value: 'Quarterly' },
                        ].map(m => (
                          <div key={m.label} className="border border-gray-100 rounded-lg p-2.5 text-center">
                            <p className="text-sm font-bold" style={{ color: BRAND.primary }}>{m.value}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{m.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 space-y-3">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Stage expectations at a glance</p>
                      {STAGES.map(s => (
                        <div key={s.key} className="flex items-start gap-2.5">
                          <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: s.color }} />
                          <div>
                            <p className="text-[11px] font-semibold" style={{ color: s.color }}>{s.label}</p>
                            <p className="text-[10px] text-gray-400 leading-tight">{s.expectation}</p>
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
                  { quote: 'I\'d been comparing myself to directors when I\'m a Senior. MetryxOne told me I\'m actually in the 81st percentile for my stage — it completely changed how I approach my performance reviews.', name: 'Ananya R.', role: 'Senior Data Scientist', industry: 'Healthcare Technology' },
                  { quote: 'The promotion readiness score was the most useful thing in our mid-year talent review. Our managers now have an objective basis for promotion conversations instead of gut feel.', name: 'David K.', role: 'Director, People Analytics', industry: 'SaaS' },
                  { quote: 'The time-to-stage estimate showed 4 months to Senior level with focused work on two competencies. I hit it in 3.5 months. The specificity of the gaps made all the difference.', name: 'Fatima O.', role: 'Mid-Level Engineer → Senior', industry: 'FinTech' },
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
                    <h3 className="text-xl font-extrabold mb-2" style={{ color: BRAND.primary }}>Know where you stand at your level</h3>
                    <p className="text-xs text-gray-500 leading-relaxed mb-5">
                      Get your Career Stage Analysis report in under 40 minutes. Includes your stage classification, stage-calibrated gap report, promotion readiness score, and time-to-next-stage estimate — free with every MetryxOne account.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button onClick={() => onNavigate('registration')} style={{ backgroundColor: BRAND.primary }} className="text-white px-6 font-semibold">
                        Get My Stage Analysis <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                      </Button>
                      <Button variant="outline" onClick={() => onNavigate('login')} className="px-6">Log In</Button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-3 flex items-center gap-1">
                      <Shield className="h-3 w-3" /> SOC 2 Type II · GDPR compliant · Data never shared
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: Zap, title: 'Instant classification', desc: 'Your stage is detected automatically — no manual form to fill in.' },
                      { icon: Shield, title: 'Fair comparison', desc: 'Always benchmarked against peers at your exact career stage.' },
                      { icon: TrendingUp, title: 'Track your progress', desc: 'Re-assess each quarter and watch your promotion readiness improve.' },
                      { icon: BookOpen, title: 'Stage-right learning', desc: 'Recommendations filtered for your level — not one-size content.' },
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
                  <TrendingUp className="h-4 w-4" style={{ color: BRAND.primary }} />
                </div>
                <div>
                  <h1 className="text-base font-bold" style={{ color: BRAND.primary }}>Career Stage Analysis</h1>
                  <p className="text-xs text-gray-400">Tailored competency scoring calibrated to your career level</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => onNavigate('competency-role-transition')} className="text-xs">Role Transition</Button>
                <Button variant="outline" size="sm" onClick={() => onNavigate('competency-intelligence')} className="text-xs">← Dashboard</Button>
              </div>
            </div>

            {roleFitQuery.isLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="text-center">
                  <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: `${BRAND.accent} transparent transparent transparent` }} />
                  <p className="text-sm text-gray-500 font-medium">Loading career stage analysis...</p>
                  <p className="text-xs text-gray-400 mt-1">Calibrating benchmarks to your career level</p>
                </div>
              </div>
            ) : roleFitQuery.isError ? (
              <div className="text-center py-16 border border-gray-200 rounded-xl">
                <TrendingUp className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-700 mb-1">Stage data unavailable</p>
                <p className="text-xs text-gray-400 mb-5 max-w-sm mx-auto">Ensure your profile, current role, and years of experience are configured.</p>
                <div className="flex justify-center gap-2">
                  <Button size="sm" onClick={() => onNavigate('competency-intelligence')} style={{ backgroundColor: BRAND.primary }} className="text-white">Set Up Profile</Button>
                  <Button size="sm" variant="outline" onClick={() => roleFitQuery.refetch()}>Retry</Button>
                </div>
              </div>
            ) : data ? (
              <div className="space-y-5">
                {/* Stage track */}
                <div className="border border-gray-200 rounded-xl p-5 bg-white">
                  <p className="text-xs font-semibold text-gray-400 mb-4">Your career progression</p>
                  <StageProgressTrack current={stageKey} />
                </div>

                {/* KPI row */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                  {/* Stage + role fit */}
                  <div className="lg:col-span-2 border border-gray-200 rounded-xl p-5 bg-white flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center border-2 flex-shrink-0" style={{ borderColor: stageInfo.color, backgroundColor: `${stageInfo.color}10` }}>
                      <Award className="h-7 w-7" style={{ color: stageInfo.color }} />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400">Current Stage</p>
                      <p className="text-xl font-extrabold" style={{ color: stageInfo.color }}>{stageInfo.label}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{data.currentRole} · {data.industry}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-[10px] text-gray-400">Role Fit</p>
                      <p className="text-3xl font-extrabold" style={{ color: BRAND.primary }}>{Math.round(data.roleFitScore ?? 0)}</p>
                      <p className="text-[10px] text-gray-400">/100</p>
                    </div>
                  </div>

                  {/* KPI cards */}
                  <div className="lg:col-span-3 grid grid-cols-3 gap-3">
                    {[
                      { label: 'Readiness Level', value: data.transition?.readinessLevel ?? '—', sub: 'For next stage', color: BRAND.accent },
                      { label: 'Overall Percentile', value: benchData ? `${benchData.overallPercentile}th` : '—', sub: 'Within your stage', color: '#6366f1' },
                      { label: 'Time to Next Stage', value: data.transition?.estimatedMonths ? `${data.transition.estimatedMonths}mo` : '—', sub: 'Estimated timeline', color: '#f59e0b' },
                    ].map(({ label, value, sub, color }) => (
                      <div key={label} className="border border-gray-200 rounded-xl p-4 bg-white">
                        <p className="text-xs text-gray-400 mb-1">{label}</p>
                        <p className="text-xl font-extrabold" style={{ color }}>{value}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {/* Stage competency factors */}
                  <div className="lg:col-span-2 space-y-4">
                    {data.factors?.length > 0 && (
                      <Card className="border border-gray-200 shadow-none">
                        <CardHeader className="py-3 px-4 border-b border-gray-100">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Users className="h-3.5 w-3.5" style={{ color: BRAND.accent }} />
                            Stage Competency Factors
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                          {data.factors.map((f: any) => {
                            const pct = Math.min(Math.round(f.score), 100);
                            const color = pct >= 75 ? '#10b981' : pct >= 55 ? BRAND.accent : pct >= 35 ? '#f59e0b' : '#ef4444';
                            return (
                              <div key={f.label}>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="font-medium text-gray-700">{f.label}</span>
                                  <span className="font-bold" style={{ color }}>{pct}</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                                </div>
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    )}

                    {/* Transition readiness */}
                    {data.transition && (
                      <Card className="border border-gray-200 shadow-none">
                        <CardHeader className="py-3 px-4 border-b border-gray-100">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                            Stage Transition Readiness
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                          <div className="grid grid-cols-3 gap-3 mb-4">
                            {[
                              { label: 'Readiness Score', value: Math.round(data.transition.readinessScore ?? 0), color: BRAND.primary },
                              { label: 'Est. Timeline', value: `${data.transition.estimatedMonths ?? '—'}mo`, color: '#f59e0b' },
                              { label: 'Critical Gaps', value: data.transition.criticalGapCount ?? 0, color: '#ef4444' },
                            ].map(({ label, value, color }) => (
                              <div key={label} className="border border-gray-100 rounded-lg p-3 text-center">
                                <p className="text-[10px] text-gray-400 mb-1">{label}</p>
                                <p className="text-xl font-extrabold" style={{ color }}>{value}</p>
                              </div>
                            ))}
                          </div>
                          {data.transition.blockingGaps?.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Blocking gaps</p>
                              <div className="space-y-1.5">
                                {data.transition.blockingGaps.slice(0, 4).map((g: any) => (
                                  <div key={g.competencyId} className="flex items-center gap-2 p-2 rounded-lg bg-red-50 border border-red-100">
                                    <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />
                                    <span className="text-xs text-red-700 font-medium">{g.competencyName}</span>
                                    <span className="ml-auto text-[10px] text-red-500 font-semibold">Gap: {g.gap}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
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
                          { label: 'Gap Analysis', screen: 'competency-gap-analysis', icon: Target },
                          { label: 'Role Transition', screen: 'competency-role-transition', icon: TrendingUp },
                          { label: 'Growth Simulation', screen: 'competency-growth-simulation', icon: BarChart3 },
                          { label: 'Learning Paths', screen: 'competency-learning-paths', icon: BookOpen },
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
                        <CardTitle className="text-xs font-semibold">Stage Expectations</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-2.5 p-3 rounded-lg border" style={{ backgroundColor: `${stageInfo.color}08`, borderColor: `${stageInfo.color}25` }}>
                          <Award className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: stageInfo.color }} />
                          <div>
                            <p className="text-xs font-semibold mb-1" style={{ color: stageInfo.color }}>{stageInfo.label}</p>
                            <p className="text-[10px] text-gray-500 leading-relaxed">{stageInfo.expectation}</p>
                          </div>
                        </div>
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
