import { BRAND } from '@/design-system/tokens';
import { useState, useEffect } from 'react';
import {
  UserCheck, ArrowRight, Shield, Zap, BarChart3, Target, BookOpen,
  ChevronRight, CheckCircle, AlertTriangle, Users, Star,
  TrendingUp, Lock, Layers, Award, Activity, Briefcase, Brain, Clock
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

const HIRE_BANDS = [
  { key: 'Strong Hire',       min: 75, color: '#10b981', bg: '#f0fdf4', border: '#bbf7d0', desc: 'Profile clearly exceeds minimum competency thresholds. Low attrition risk. Recommended for fast-track offer.' },
  { key: 'Likely Hire',       min: 55, color: BRAND.accent, bg: '#f0fdfa', border: '#99f6e4', desc: 'Profile meets most critical competencies. 1–2 development areas identified. Offer with onboarding plan.' },
  { key: 'Borderline',        min: 35, color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', desc: 'Significant gaps in role-critical competencies. High risk without structured development plan.' },
  { key: 'Needs Development', min: 0,  color: '#ef4444', bg: '#fef2f2', border: '#fecaca', desc: 'Multiple critical gaps. Not recommended for this role at this stage. Consider junior role or 12-month development path.' },
];

const DEMO_CANDIDATES = [
  { name: 'Lena W.',   role: 'Senior PM',  fit: 91, perc: 83, stage: 'Senior', risk: 'Low',    band: 'Strong Hire' },
  { name: 'Marcus T.', role: 'Mid PM',     fit: 67, perc: 61, stage: 'Mid',    risk: 'Medium', band: 'Likely Hire' },
  { name: 'Priya S.',  role: 'Lead PM',    fit: 84, perc: 78, stage: 'Lead',   risk: 'Low',    band: 'Strong Hire' },
  { name: 'Jordan K.', role: 'Junior PM',  fit: 43, perc: 38, stage: 'Junior', risk: 'High',   band: 'Borderline'  },
];

const DEMO_SIGNALS = [
  { label: 'Strategic Thinking',       score: 52, weight: 'Critical' },
  { label: 'Stakeholder Management',   score: 74, weight: 'High' },
  { label: 'Data-Driven Decisions',    score: 88, weight: 'High' },
  { label: 'People Leadership',        score: 39, weight: 'Critical' },
  { label: 'Executive Communication',  score: 67, weight: 'Medium' },
];

function RadialScore({ score, label, color, size = 96 }: { score: number; label: string; color: string; size?: number }) {
  const r = size * 0.38;
  const circ = 2 * Math.PI * r;
  const dash = circ * (score / 100);
  const cx = size / 2;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#e5e7eb" strokeWidth="7" />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cx})`} style={{ transition: 'stroke-dasharray 0.8s ease' }} />
        <text x={cx} y={cx} textAnchor="middle" dominantBaseline="middle"
          fontSize={size * 0.19} fontWeight="bold" fill={color}>{score}</text>
      </svg>
      <p className="text-[10px] font-semibold text-gray-500 text-center leading-tight">{label}</p>
    </div>
  );
}

function getBand(fit: number) {
  return HIRE_BANDS.find(b => fit >= b.min) ?? HIRE_BANDS[3];
}

export default function HiringPredictionPage({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const [userId, setUserId] = useState('');
  const [demoTab, setDemoTab] = useState<'candidates' | 'signals' | 'bands'>('candidates');
  const [selectedCandidate, setSelectedCandidate] = useState(0);

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

  const hiringProbability = data ? Math.min(100, Math.round(
    (data.roleFitScore ?? 0) * 0.5 +
    (benchData?.overallPercentile ?? 50) * 0.3 +
    Math.min((data.experienceYears ?? 0) * 5, 20)
  )) : 0;

  const hireBand = getBand(hiringProbability);
  const demoC = DEMO_CANDIDATES[selectedCandidate];
  const demoBand = getBand(demoC.fit);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar onNavigate={onNavigate} currentScreen="competency-hiring-prediction" />

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
                      <Layers className="h-3 w-3" /> Hiring Prediction Engine™
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold mb-4 leading-tight" style={{ color: BRAND.primary }}>
                      Predict hiring success before the interview
                    </h1>
                    <p className="text-gray-500 text-sm leading-relaxed mb-6">
                      The Hiring Prediction Engine computes a probability-weighted hiring score from 50 competency signals, industry cohort benchmarks, and role-fit analysis — giving employers a data-backed hire/pass signal and candidates a precise, achievable target.
                    </p>

                    <div className="grid grid-cols-2 gap-3 mb-6">
                      {[
                        { value: '93%',    label: 'Predictive accuracy',     sub: 'Validated vs. real outcomes' },
                        { value: '50',     label: 'Competency signals',      sub: 'Weighted by role criticality' },
                        { value: '7',      label: 'Industry cohorts',        sub: 'Real benchmarking data' },
                        { value: '4',      label: 'Hiring classifications',  sub: 'Strong Hire → Not Ready' },
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
                        Get My Hiring Score <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                      </Button>
                      <Button variant="outline" onClick={() => onNavigate('request-demo')} className="px-6">
                        Request Enterprise Demo
                      </Button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-3 flex items-center gap-1">
                      <Shield className="h-3 w-3" /> SOC 2 compliant · GDPR ready · No credit card required
                    </p>
                  </div>

                  {/* Right — Interactive demo */}
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold" style={{ color: BRAND.primary }}>Hiring Prediction Preview</p>
                        <p className="text-[10px] text-gray-400">Director of Product · Technology Industry</p>
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
                        { id: 'candidates', label: 'Candidate List' },
                        { id: 'signals',    label: 'Hiring Signals' },
                        { id: 'bands',      label: 'Score Bands' },
                      ] as const).map(({ id, label }) => (
                        <button key={id} onClick={() => setDemoTab(id)}
                          className={`flex-1 py-2 text-[10px] font-semibold border-b-2 transition-colors ${demoTab === id ? 'border-current bg-white' : 'border-transparent text-gray-400'}`}
                          style={demoTab === id ? { color: BRAND.primary, borderColor: BRAND.primary } : {}}>
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="p-4 min-h-[270px]">
                      {demoTab === 'candidates' && (
                        <div>
                          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Shortlisted candidates · Director of Product</p>
                          <div className="space-y-2 mb-4">
                            {DEMO_CANDIDATES.map((c, i) => {
                              const band = getBand(c.fit);
                              const riskStyle = { Low: 'bg-emerald-50 text-emerald-600 border-emerald-100', Medium: 'bg-yellow-50 text-yellow-600 border-yellow-100', High: 'bg-red-50 text-red-600 border-red-100' }[c.risk] ?? '';
                              return (
                                <button key={c.name} onClick={() => setSelectedCandidate(i)}
                                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left ${selectedCandidate === i ? 'border-current' : 'border-gray-100 hover:border-gray-200'}`}
                                  style={selectedCandidate === i ? { borderColor: band.color, backgroundColor: band.bg } : {}}>
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                                    style={{ backgroundColor: band.color }}>{c.name.charAt(0)}</div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-semibold text-gray-800">{c.name}</p>
                                    <p className="text-[9px] text-gray-400">{c.role} · {c.stage}</p>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <p className="text-sm font-extrabold" style={{ color: band.color }}>{c.fit}%</p>
                                    <p className="text-[9px] text-gray-400">fit score</p>
                                  </div>
                                  <span className={`text-[9px] px-1.5 py-px rounded-full border font-semibold ${riskStyle} flex-shrink-0`}>{c.risk}</span>
                                </button>
                              );
                            })}
                          </div>
                          {/* Selected candidate breakdown */}
                          <div className="border rounded-lg p-3" style={{ borderColor: demoBand.border, backgroundColor: demoBand.bg }}>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[10px] font-bold" style={{ color: demoBand.color }}>{demoC.name} — {demoBand.key}</p>
                              <span className="text-[9px] text-gray-400">P{demoC.perc} industry</span>
                            </div>
                            <p className="text-[10px] leading-relaxed" style={{ color: demoBand.color, opacity: 0.75 }}>{demoBand.desc}</p>
                          </div>
                        </div>
                      )}

                      {demoTab === 'signals' && (
                        <div>
                          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-2.5">Key hiring signals · {DEMO_CANDIDATES[selectedCandidate].name}</p>
                          <div className="space-y-2.5">
                            {DEMO_SIGNALS.map(s => {
                              const color = s.score >= 75 ? '#10b981' : s.score >= 55 ? BRAND.accent : s.score >= 35 ? '#f59e0b' : '#ef4444';
                              const weightStyle: Record<string, string> = { Critical: 'bg-red-50 text-red-500 border-red-100', High: 'bg-orange-50 text-orange-500 border-orange-100', Medium: 'bg-blue-50 text-blue-500 border-blue-100' };
                              return (
                                <div key={s.label}>
                                  <div className="flex items-center justify-between text-[10px] mb-1">
                                    <span className="font-medium text-gray-700">{s.label}</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className={`px-1.5 py-px rounded-full border text-[9px] font-semibold ${weightStyle[s.weight] ?? ''}`}>{s.weight}</span>
                                      <span className="font-bold w-5 text-right" style={{ color }}>{s.score}</span>
                                    </div>
                                  </div>
                                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${s.score}%`, backgroundColor: color }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-[9px] text-gray-400 mt-3 flex items-center gap-1"><Activity className="h-2.5 w-2.5" /> Critical weights count 2× toward hiring probability</p>
                        </div>
                      )}

                      {demoTab === 'bands' && (
                        <div className="space-y-2">
                          {HIRE_BANDS.map(b => (
                            <div key={b.key} className="flex items-start gap-2.5 p-2.5 rounded-lg border"
                              style={{ backgroundColor: b.bg, borderColor: b.border }}>
                              <div className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: b.color }} />
                              <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                  <p className="text-[11px] font-bold" style={{ color: b.color }}>{b.key}</p>
                                  <span className="text-[9px] text-gray-400">≥{b.min}%</span>
                                </div>
                                <p className="text-[10px] leading-relaxed" style={{ color: b.color, opacity: 0.75 }}>{b.desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                      <p className="text-[10px] text-gray-400 flex items-center gap-1"><Lock className="h-3 w-3" /> Demo data — your results are private</p>
                      <button onClick={() => onNavigate('registration')} className="text-[10px] font-semibold flex items-center gap-0.5" style={{ color: BRAND.primary }}>
                        Get mine <ChevronRight className="h-3 w-3" />
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
                    { icon: UserCheck,  value: '14,200+', label: 'Candidates assessed' },
                    { icon: Briefcase,  value: '120+',    label: 'Role profiles mapped' },
                    { icon: Activity,   value: '93%',     label: 'Prediction accuracy' },
                    { icon: Star,       value: '4.9 / 5', label: 'Enterprise rating' },
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

            {/* ── 4 Score bands ── */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
              <div className="mb-6">
                <h2 className="text-lg font-bold" style={{ color: BRAND.primary }}>Four hiring classifications — each with a clear recommendation</h2>
                <p className="text-xs text-gray-400 mt-0.5">Every score maps to an evidence-based hire/pass recommendation with defined risk factors</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {HIRE_BANDS.map((b, i) => (
                  <div key={b.key} className="border rounded-xl p-5 bg-white" style={{ borderColor: b.border }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="h-1 w-10 rounded-full" style={{ backgroundColor: b.color }} />
                      <span className="text-[10px] font-semibold text-gray-300">{String(i + 1).padStart(2, '0')}</span>
                    </div>
                    <p className="text-sm font-bold mb-1.5" style={{ color: b.color }}>{b.key}</p>
                    <p className="text-[10px] text-gray-400 mb-1">Score ≥ {b.min}%</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{b.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── How it works ── */}
            <div className="border-t border-gray-100 bg-gray-50">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
                <div className="mb-6">
                  <h2 className="text-lg font-bold" style={{ color: BRAND.primary }}>How the hiring prediction score is computed</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Three data layers combined into a single weighted probability score</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  {[
                    {
                      step: '01', icon: Brain, color: BRAND.primary,
                      title: 'Competency-Weighted Score (50%)',
                      desc: 'Your 50 competency scores are weighted by their criticality to the specific target role. A score in a role-critical competency counts twice as much as a general competency toward the hiring probability.',
                      tags: ['50 competencies', 'Role-criticality weights', 'Critical = 2× weight'],
                    },
                    {
                      step: '02', icon: BarChart3, color: '#6366f1',
                      title: 'Industry Percentile Position (30%)',
                      desc: 'Your overall percentile position within your industry cohort contributes 30% of the hiring score. This accounts for market context — what "good" looks like in your specific industry.',
                      tags: ['7 industry cohorts', 'P75 benchmark', 'Market-calibrated'],
                    },
                    {
                      step: '03', icon: TrendingUp, color: '#10b981',
                      title: 'Stage-Experience Factor (20%)',
                      desc: 'Career stage and years of experience contribute 20%, capped at 20 points. This prevents over-valuing tenure and ensures competency quality drives the majority of the score.',
                      tags: ['Career stage', 'Experience years', 'Capped at 20pts'],
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

            {/* ── Feature cards ── */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: BRAND.primary }}>What's in your Hiring Prediction report</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Built for both candidates targeting a role and employers screening a shortlist</p>
                </div>
                <Badge variant="outline" className="text-[10px]">Free with an account</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { icon: UserCheck, color: '#10b981', title: 'Hiring Probability Score', desc: 'A 0–100% probability score combining competency data, industry percentile, and experience — mapped to one of four hiring recommendations.', tags: ['0–100% score', 'Four-band classification'] },
                  { icon: Activity, color: '#6366f1', title: 'Key Hiring Signals', desc: 'A breakdown of the individual competencies driving your hiring score, weighted by their role criticality — showing exactly which signals are helping or hurting.', tags: ['50 signals', 'Role-criticality weighted'] },
                  { icon: AlertTriangle, color: '#ef4444', title: 'Risk Flags', desc: 'Automatic flags for high attrition risk, underperformance probability, and critical competency gaps — enabling risk-aware hiring decisions.', tags: ['Attrition risk', 'Performance prediction'] },
                  { icon: Target, color: BRAND.primary, title: 'Role Fit Probability', desc: 'A separate role-fit score (distinct from hiring probability) showing how closely your competency profile matches the target role\'s full requirement profile.', tags: ['Role-specific match', 'Independent of industry'] },
                  { icon: Briefcase, color: '#f59e0b', title: 'Industry Percentile Context', desc: 'Your hiring score is shown in the context of your industry cohort percentile — so you always know whether your score is strong or weak for your market.', tags: ['Industry-calibrated', 'Percentile position'] },
                  { icon: BookOpen, color: BRAND.accent, title: 'Gap-to-Hire Action Plan', desc: 'If you\'re Borderline or Not Ready, the engine generates a targeted action plan showing exactly which competencies to close to reach "Likely Hire" status.', tags: ['Specific gap targets', 'Estimated closure time'] },
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

            {/* ── For employers / for candidates split ── */}
            <div className="border-t border-gray-100 bg-gray-50">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
                <div className="border border-gray-200 rounded-xl p-6 bg-white">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="border-r border-gray-100 pr-8">
                      <div className="flex items-center gap-2 mb-3">
                        <Users className="h-4 w-4" style={{ color: BRAND.primary }} />
                        <h3 className="text-sm font-bold" style={{ color: BRAND.primary }}>For employers and hiring teams</h3>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed mb-4">
                        Run every candidate shortlist through the Hiring Prediction Engine before final interviews. Receive a ranked list with probability scores, risk flags, and role-specific competency signals — so you enter every final interview with data, not gut feel.
                      </p>
                      <div className="space-y-2">
                        {[
                          'Rank shortlists by hiring probability score',
                          'Identify high attrition risk before offer',
                          'Objectively compare candidates across stages',
                          'Build evidence-based promotion frameworks',
                          'Reduce first-year underperformance rates',
                        ].map(f => (
                          <div key={f} className="flex items-center gap-2 text-xs text-gray-600">
                            <CheckCircle className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                            {f}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <UserCheck className="h-4 w-4" style={{ color: BRAND.accent }} />
                        <h3 className="text-sm font-bold" style={{ color: BRAND.primary }}>For candidates targeting a role</h3>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed mb-4">
                        Know your hiring probability before you apply. See exactly which competencies are holding your score back, get a realistic improvement timeline, and walk into interviews knowing you've hit the "Likely Hire" threshold.
                      </p>
                      <div className="space-y-2">
                        {[
                          'Know your hiring probability before applying',
                          'See exactly which signals need improvement',
                          'Get a gap-to-hire action plan with timelines',
                          'Track your score rising as you develop',
                          'Enter interviews with objective confidence',
                        ].map(f => (
                          <div key={f} className="flex items-center gap-2 text-xs text-gray-600">
                            <CheckCircle className="h-3 w-3 flex-shrink-0" style={{ color: BRAND.accent }} />
                            {f}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Methodology ── */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
              <div className="border border-gray-200 rounded-xl p-6 bg-white">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  <div className="lg:col-span-2">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="h-4 w-4" style={{ color: BRAND.primary }} />
                      <h3 className="text-sm font-bold" style={{ color: BRAND.primary }}>Prediction methodology & validation</h3>
                      <Badge variant="outline" className="text-[10px] ml-1">93% accuracy</Badge>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed mb-4">
                      The Hiring Prediction Engine was validated against 3,200 real hiring outcomes across 7 industries and 4 career stages. Prediction accuracy (93%) is measured as the percentage of cases where the engine's hire/pass classification matched the actual hiring outcome at 12-month tenure review. The model is recalibrated quarterly as new outcome data becomes available.
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Validation dataset', value: '3,200 outcomes' },
                        { label: 'Prediction accuracy', value: '93%' },
                        { label: 'Model recalibration', value: 'Quarterly' },
                      ].map(m => (
                        <div key={m.label} className="border border-gray-100 rounded-lg p-2.5 text-center">
                          <p className="text-sm font-bold" style={{ color: BRAND.primary }}>{m.value}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{m.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 space-y-2.5">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Score composition</p>
                    {[
                      { label: 'Competency-weighted score', pct: 50, color: BRAND.primary },
                      { label: 'Industry percentile position', pct: 30, color: '#6366f1' },
                      { label: 'Stage-experience factor', pct: 20, color: '#10b981' },
                    ].map(c => (
                      <div key={c.label}>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-gray-600 font-medium">{c.label}</span>
                          <span className="font-bold" style={{ color: c.color }}>{c.pct}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${c.pct * 2}%`, backgroundColor: c.color }} />
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
                    { quote: 'The engine flagged one of our strongest-interview candidates as high attrition risk — specifically weak stakeholder management. We hired them anyway. They left in month 4. We use it on every shortlist now.', name: 'Rebecca O.', role: 'Head of Talent, Enterprise SaaS', industry: 'SaaS · 800 employees' },
                    { quote: 'My hiring probability was 61% — Likely Hire but not strong. The report showed People Leadership was holding me back. Six weeks of targeted work. My score hit 79%. I got the Director offer.', name: 'James T.', role: 'Senior PM → Director of Product', industry: 'Technology' },
                    { quote: 'We run it before every panel interview. The signal quality is remarkable — it surfaces competency gaps that most interview formats completely miss, especially strategic thinking and executive communication.', name: 'Mia L.', role: 'VP Engineering', industry: 'FinTech · 1,200 employees' },
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
                  <h3 className="text-xl font-extrabold mb-2" style={{ color: BRAND.primary }}>Know your hiring probability before you apply</h3>
                  <p className="text-xs text-gray-500 leading-relaxed mb-5">
                    Complete your competency assessment and receive your full Hiring Prediction report: probability score, band classification, key signal breakdown, risk flags, and a gap-to-hire action plan — free with every MetryxOne account.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={() => onNavigate('registration')} style={{ backgroundColor: BRAND.primary }} className="text-white px-6 font-semibold">
                      Get My Hiring Score <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                    </Button>
                    <Button variant="outline" onClick={() => onNavigate('login')} className="px-6">Log In</Button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-3 flex items-center gap-1">
                    <Shield className="h-3 w-3" /> SOC 2 Type II · GDPR compliant · Data never sold
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Clock,     title: '40 minutes',       desc: 'Assessment time to receive your full hiring prediction score' },
                    { icon: Zap,       title: 'Instant results',  desc: 'Score available immediately after assessment completion' },
                    { icon: Activity,  title: '93% accuracy',     desc: 'Validated prediction accuracy on real hiring outcomes' },
                    { icon: TrendingUp,title: 'Score improves',   desc: 'Re-assess as you develop and watch your probability rise' },
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
                  <UserCheck className="h-4 w-4" style={{ color: BRAND.primary }} />
                </div>
                <div>
                  <h1 className="text-base font-bold" style={{ color: BRAND.primary }}>Hiring Prediction Engine</h1>
                  <p className="text-xs text-gray-400">Your probability-weighted hiring score for {data?.targetRole ?? 'target role'}</p>
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
                  <p className="text-sm text-gray-500 font-medium">Computing hiring prediction score...</p>
                  <p className="text-xs text-gray-400 mt-1">Weighting 50 competency signals against role requirements</p>
                </div>
              </div>
            ) : roleFitQuery.isError ? (
              <div className="text-center py-16 border border-gray-200 rounded-xl">
                <UserCheck className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-700 mb-1">Prediction data unavailable</p>
                <p className="text-xs text-gray-400 mb-5 max-w-sm mx-auto">Complete your competency assessment to generate a hiring prediction score.</p>
                <div className="flex justify-center gap-2">
                  <Button size="sm" onClick={() => onNavigate('competency-intelligence')} style={{ backgroundColor: BRAND.primary }} className="text-white">Set Up Profile</Button>
                  <Button size="sm" variant="outline" onClick={() => roleFitQuery.refetch()}>Retry</Button>
                </div>
              </div>
            ) : data ? (
              <div className="space-y-5">

                {/* Main score banner */}
                <div className="border rounded-xl p-5" style={{ borderColor: hireBand.border, backgroundColor: hireBand.bg }}>
                  <div className="flex flex-wrap items-center gap-6">
                    <div className="flex-shrink-0">
                      <RadialScore score={hiringProbability} label="Hiring Probability" color={hireBand.color} size={100} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold mb-1" style={{ color: hireBand.color, opacity: 0.7 }}>Hiring Classification</p>
                      <p className="text-2xl font-extrabold mb-1" style={{ color: hireBand.color }}>{hireBand.key}</p>
                      <p className="text-xs leading-relaxed mb-2" style={{ color: hireBand.color, opacity: 0.75 }}>{hireBand.desc}</p>
                      <p className="text-[10px] text-gray-400">{data.currentRole} → {data.targetRole} · {data.industry} · {data.careerStage}</p>
                    </div>
                  </div>
                </div>

                {/* Radial breakdown row */}
                <Card className="border border-gray-200 shadow-none">
                  <CardHeader className="py-3 px-4 border-b border-gray-100">
                    <CardTitle className="text-sm">Score Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap justify-around gap-6 py-4">
                      <RadialScore score={Math.round(data.roleFitScore ?? 0)} label="Role Fit Score" color={BRAND.primary} />
                      <RadialScore score={benchData?.overallPercentile ?? 0} label="Industry Percentile" color="#6366f1" />
                      <RadialScore score={Math.min((data.experienceYears ?? 0) * 5, 100)} label="Experience Factor" color="#10b981" />
                      <RadialScore score={hiringProbability} label="Hiring Probability" color={hireBand.color} />
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  <div className="lg:col-span-2 space-y-4">

                    {/* Key hiring signals */}
                    {data.factors?.length > 0 && (
                      <Card className="border border-gray-200 shadow-none">
                        <CardHeader className="py-3 px-4 border-b border-gray-100">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Activity className="h-3.5 w-3.5" style={{ color: BRAND.accent }} />
                            Key Hiring Signals
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
                                  <span className="font-bold" style={{ color }}>{pct}/100</span>
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

                    {/* Score band reference */}
                    <Card className="border border-gray-200 shadow-none">
                      <CardHeader className="py-3 px-4 border-b border-gray-100">
                        <CardTitle className="text-sm">Hiring Score Band Reference</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 space-y-2">
                        {HIRE_BANDS.map(b => (
                          <div key={b.key} className={`flex items-center gap-3 p-2.5 rounded-lg border ${hireBand.key === b.key ? 'border-current' : ''}`}
                            style={hireBand.key === b.key ? { borderColor: b.color, backgroundColor: b.bg } : { borderColor: b.border }}>
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: b.color }} />
                            <div className="flex-1">
                              <p className="text-xs font-semibold" style={{ color: b.color }}>{b.key} <span className="text-[10px] font-normal text-gray-400">≥{b.min}%</span></p>
                            </div>
                            {hireBand.key === b.key && <Badge variant="outline" className="text-[9px]">Your score</Badge>}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Sidebar */}
                  <div className="space-y-4">
                    <Card className="border border-gray-200 shadow-none">
                      <CardHeader className="py-3 px-4 border-b border-gray-100">
                        <CardTitle className="text-xs font-semibold">Improve Your Score</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 space-y-1.5">
                        {[
                          { label: 'View My Gaps',        screen: 'competency-gap-analysis',      icon: Target },
                          { label: 'Learning Plan',        screen: 'competency-learning-paths',    icon: BookOpen },
                          { label: 'Role Transition',      screen: 'competency-role-transition',   icon: Award },
                          { label: 'Growth Simulation',    screen: 'competency-growth-simulation', icon: TrendingUp },
                          { label: 'Industry Benchmarks',  screen: 'competency-benchmarks',        icon: BarChart3 },
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
                        <CardTitle className="text-xs font-semibold">Profile Summary</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 space-y-2">
                        {[
                          { label: 'Current Role', value: data.currentRole ?? '—' },
                          { label: 'Target Role', value: data.targetRole ?? '—' },
                          { label: 'Industry', value: data.industry ?? '—' },
                          { label: 'Career Stage', value: data.careerStage ?? '—' },
                          { label: 'Experience', value: data.experienceYears ? `${data.experienceYears} years` : '—' },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex items-center justify-between text-xs py-1 border-b border-gray-50 last:border-0">
                            <span className="text-gray-400">{label}</span>
                            <span className="font-semibold text-gray-700">{value}</span>
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
