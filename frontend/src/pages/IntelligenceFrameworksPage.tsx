import { useState } from 'react';
import {
  Brain, Sparkles, Gauge, ArrowRight, Shield, Zap, BarChart3, Target,
  ChevronRight, CheckCircle, Users, Star, TrendingUp, Lock,
  Layers, Activity, Clock, BookOpen, Award, GraduationCap, Heart,
  RefreshCw, MessageSquare, Eye, Compass, ScanSearch, HelpCircle,
  Puzzle, Workflow, AlertTriangle, School, GitBranch, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Screen } from '../App';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';

// ── MetryxOne single-hue navy system ──────────────────────────────────────
const N0 = '#0d1f42'; // deepest
const N1 = '#1e3461'; // dark
const N2 = '#344E86'; // primary ← brand
const N3 = '#3d5a9a'; // mid-upper
const N4 = '#4F6BBD'; // medium
const N5 = '#6279C4'; // lighter
const N6 = '#7B8FCF'; // light
const N7 = '#B8C4E0'; // pale
const N8 = '#D6DCF0'; // very pale
const NT = '#EEF1F8'; // near-white tint

// sequential palette for multi-item charts (all navy family)
const SEQ = [N0, N1, N2, N3, N4, N5, N6, N7];

type FrameworkId = 'lbi' | 'eri' | 'cip';

const LBI_MODULES = [
  { code: 'M1', name: 'Cognitive Core',          domains: 2, subs: 14, score: 75, color: N0 },
  { code: 'M2', name: 'Emotional Regulation',    domains: 3, subs: 22, score: 68, color: N1 },
  { code: 'M3', name: 'Social & Behavioural',    domains: 3, subs: 14, score: 73, color: N2 },
  { code: 'M4', name: 'Drive & Environment',     domains: 2, subs: 9,  score: 68, color: N3 },
  { code: 'M5', name: 'Performance & Planning',  domains: 3, subs: 15, score: 76, color: N4 },
  { code: 'M6', name: 'Self-Awareness',          domains: 3, subs: 11, score: 65, color: N5 },
  { code: 'M7', name: 'Adaptability',            domains: 3, subs: 12, score: 66, color: N6 },
];

const LBI_DOMAINS = [
  { id: 'D01', name: 'Academic & Cognitive Effectiveness',     subs: 6,  icon: Brain,         module: 'M1' },
  { id: 'D02', name: 'Thinking Quality Under Pressure',        subs: 8,  icon: Target,        module: 'M1' },
  { id: 'D03', name: 'Exam Stress & Emotional Regulation',     subs: 9,  icon: Activity,      module: 'M2' },
  { id: 'D04', name: 'Confidence, Self-Concept & Comparison',  subs: 9,  icon: Star,          module: 'M2' },
  { id: 'D05', name: 'Adjustment & Coping Capacity',           subs: 4,  icon: RefreshCw,     module: 'M3' },
  { id: 'D06', name: 'Social & Emotional Intelligence',        subs: 4,  icon: Heart,         module: 'M3' },
  { id: 'D07', name: 'Discipline, Habits & Consistency',       subs: 5,  icon: Clock,         module: 'M3' },
  { id: 'D08', name: 'Communication & Expression',             subs: 5,  icon: MessageSquare, module: 'M4' },
  { id: 'D09', name: 'Motivation, Values & Responsibility',    subs: 5,  icon: Zap,           module: 'M4' },
  { id: 'D10', name: 'Lifestyle & Pressure Environment',       subs: 4,  icon: Eye,           module: 'M5' },
  { id: 'D11', name: 'Competitive Exam Readiness',             subs: 5,  icon: Award,         module: 'M5' },
  { id: 'D12', name: 'Integrated Root Cause Mapping',          subs: 4,  icon: GitBranch,     module: 'M5' },
  { id: 'D13', name: 'Academic Planning & Recovery',           subs: 6,  icon: Compass,       module: 'M6' },
  { id: 'D14', name: 'Metacognition & Self-Regulation',        subs: 3,  icon: ScanSearch,    module: 'M6' },
  { id: 'D15', name: 'Help-Seeking & Support Utilization',     subs: 4,  icon: HelpCircle,    module: 'M6' },
  { id: 'D16', name: 'Academic Identity & Meaning',            subs: 4,  icon: Puzzle,        module: 'M7' },
  { id: 'D17', name: 'Transition & Change Adaptability',       subs: 6,  icon: Workflow,      module: 'M7' },
  { id: 'D18', name: 'Teacher-Student Interaction',            subs: 3,  icon: School,        module: 'M7' },
  { id: 'D19', name: 'Over-Compliance Risk',                   subs: 3,  icon: AlertTriangle, module: 'M7' },
];

const ERI_DIMENSIONS = [
  { code: 'E1', name: 'Cognitive Preparedness',      indicators: 5, score: 78, color: N0, desc: 'Working memory load, retrieval accuracy, conceptual recall under simulated exam conditions' },
  { code: 'E2', name: 'Stress & Anxiety Management', indicators: 4, score: 61, color: N1, desc: 'Pre-exam anxiety levels, stress reactivity, physiological activation, and recovery speed' },
  { code: 'E3', name: 'Exam Execution Strategy',     indicators: 4, score: 83, color: N2, desc: 'Time allocation, question sequencing, skip-return patterns, and mark-review discipline' },
  { code: 'E4', name: 'Focus & Attention Control',   indicators: 4, score: 70, color: N3, desc: 'Sustained attention span, distraction resistance, and dual-task performance stability' },
  { code: 'E5', name: 'Recovery & Resilience',       indicators: 4, score: 65, color: N4, desc: 'Error recovery speed, mid-exam composure restoration, and post-question reset ability' },
  { code: 'E6', name: 'Self-Belief & Motivation',    indicators: 3, score: 72, color: N5, desc: 'Exam self-efficacy, performance attribution style, and approach vs. avoidance orientation' },
];

const CIP_DOMAINS = [
  { domain: 'Strategic Thinking',      weight: 'Critical', score: 68 },
  { domain: 'People Leadership',       weight: 'Critical', score: 52 },
  { domain: 'Stakeholder Management',  weight: 'High',     score: 74 },
  { domain: 'Data-Driven Decisions',   weight: 'High',     score: 81 },
  { domain: 'Executive Communication', weight: 'High',     score: 63 },
  { domain: 'Innovation & Agility',    weight: 'Medium',   score: 70 },
  { domain: 'Commercial Acumen',       weight: 'Medium',   score: 59 },
];

const CIP_STAGES = [
  { stage: 'Junior', range: '0–2 yrs',  threshold: 55 },
  { stage: 'Mid',    range: '2–5 yrs',  threshold: 65 },
  { stage: 'Senior', range: '5–10 yrs', threshold: 72 },
  { stage: 'Lead',   range: '10+ yrs',  threshold: 80 },
];

const LBI_COMPOSITE = Math.round(LBI_MODULES.reduce((s, m) => s + m.score, 0) / LBI_MODULES.length);
const ERI_COMPOSITE = Math.round(ERI_DIMENSIONS.reduce((s, d) => s + d.score, 0) / ERI_DIMENSIONS.length);
const CIP_COMPOSITE = Math.round(CIP_DOMAINS.reduce((s, d) => s + d.score, 0) / CIP_DOMAINS.length);

// ── Sub-components ──────────────────────────────────────────────────────────
function Bar({ score, color = N2, bg = N8 }: { score: number; color?: string; bg?: string }) {
  return (
    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: bg }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${score}%`, backgroundColor: color }} />
    </div>
  );
}

function Ring({ score, size = 56 }: { score: number; size?: number }) {
  const r = size * 0.38; const circ = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={N8} strokeWidth="5" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={N2} strokeWidth="5"
          strokeDasharray={`${circ * score / 100} ${circ}`}
          strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} />
        <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
          fontSize={size * 0.19} fontWeight="800" fill={N2}>{score}%</text>
      </svg>
      <p className="text-[9px] font-semibold text-gray-400 text-center">Composite</p>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export function IntelligenceFrameworksPage({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const [activeFramework, setActiveFramework] = useState<FrameworkId>('lbi');
  const [activeLbiModule, setActiveLbiModule] = useState<string | null>(null);
  const [activeEriDim, setActiveEriDim]       = useState<string | null>(null);
  const [activeCipStage, setActiveCipStage]   = useState<string>('Senior');

  const frameworks: { id: FrameworkId; label: string; sub: string; icon: any; shade: string; stats: string[] }[] = [
    { id: 'lbi', label: 'LBI™', sub: 'Learning Behavior Index',      icon: Brain,    shade: N2, stats: ['19 Domains', '97 Subdomains', '7 Modules']        },
    { id: 'eri', label: 'ERI™', sub: 'Exam Readiness Index',         icon: Sparkles, shade: N4, stats: ['6 Dimensions', '24 Indicators', '3 Stages']        },
    { id: 'cip', label: 'CIP™', sub: 'Competency Intelligence',      icon: Gauge,    shade: N1, stats: ['50 Competencies', '7 Industries', '4 Stages']      },
  ];

  const fw            = frameworks.find(f => f.id === activeFramework)!;
  const filteredDoms  = activeLbiModule ? LBI_DOMAINS.filter(d => d.module === activeLbiModule) : LBI_DOMAINS.slice(0, 6);
  const cipThreshold  = CIP_STAGES.find(s => s.stage === activeCipStage)?.threshold ?? 72;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar onNavigate={onNavigate} currentScreen="lbi-product" />

      <main className="flex-1 pt-16">

        {/* ════════════════════════════════════════════════════════════════
            HERO — dark MetryxOne gradient
        ════════════════════════════════════════════════════════════════ */}
        <div style={{ background: `linear-gradient(135deg, ${N0} 0%, ${N1} 40%, ${N2} 100%)` }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

              {/* ── Left copy ── */}
              <div>
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border mb-5"
                  style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)', backgroundColor: 'rgba(255,255,255,0.08)' }}
                >
                  <Layers className="h-3 w-3" /> Intelligence Frameworks
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-white mb-4 leading-tight tracking-tight">
                  Three proprietary assessment engines. One intelligence architecture.
                </h1>
                <p className="text-white/55 text-sm leading-relaxed mb-8">
                  MetryxOne's three assessment engines — LBI™, ERI™, and CIP™ — are each mapped to a distinct intelligence domain with validated, science-backed scoring architecture. Together they form a complete behavioral and competency intelligence layer for learners, exam candidates, and working professionals.
                </p>

                {/* Framework selector */}
                <div className="space-y-2 mb-8">
                  {frameworks.map(f => {
                    const active = activeFramework === f.id;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setActiveFramework(f.id)}
                        className="w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-all focus:outline-none"
                        style={{
                          backgroundColor: active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                          border: `1.5px solid ${active ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)'}`,
                        }}
                      >
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: active ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)' }}
                        >
                          <f.icon className="h-4.5 w-4.5 text-white" size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-white">{f.label}</span>
                            <span className="text-xs text-white/50 font-medium">{f.sub}</span>
                          </div>
                          <div className="flex gap-1.5 mt-0.5 flex-wrap">
                            {f.stats.map(s => (
                              <span
                                key={s}
                                className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                                style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
                              >{s}</span>
                            ))}
                          </div>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-white/30" />
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => onNavigate('registration')}
                    className="text-white px-6 font-bold border-0"
                    style={{ backgroundColor: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(4px)' }}
                  >
                    Get Assessed <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onNavigate('request-demo')}
                    className="px-6 font-semibold"
                    style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)', backgroundColor: 'transparent' }}
                  >
                    Request Enterprise Demo
                  </Button>
                </div>
                <p className="text-[10px] text-white/30 mt-3 flex items-center gap-1">
                  <Shield className="h-3 w-3" /> SOC 2 compliant · GDPR ready · No credit card required
                </p>
              </div>

              {/* ── Right — interactive visualiser ── */}
              <div
                className="rounded-2xl overflow-hidden border"
                style={{ borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)' }}
              >
                {/* header */}
                <div
                  className="px-5 py-3.5 flex items-center justify-between border-b"
                  style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)' }}
                >
                  <div>
                    <p className="text-sm font-bold text-white">{fw.label} — {fw.sub}</p>
                    <p className="text-[10px] text-white/40 mt-0.5">
                      {activeFramework === 'lbi' && '7 modules · 19 domains · 97 subdomains'}
                      {activeFramework === 'eri' && '6 dimensions · 24 indicators · 3 exam stages'}
                      {activeFramework === 'cip' && '50 competencies · 7 industries · 4 career stages'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {frameworks.map(f => (
                      <button
                        key={f.id}
                        onClick={() => setActiveFramework(f.id)}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-black transition-all"
                        style={{
                          backgroundColor: activeFramework === f.id ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                          color: activeFramework === f.id ? '#fff' : 'rgba(255,255,255,0.35)',
                          border: `1.5px solid ${activeFramework === f.id ? 'rgba(255,255,255,0.3)' : 'transparent'}`,
                        }}
                      >{f.label.slice(0, 1)}</button>
                    ))}
                  </div>
                </div>

                {/* ── LBI panel ── */}
                {activeFramework === 'lbi' && (
                  <div className="p-5">
                    <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-3">Module scores · click to filter domains</p>
                    <div className="flex items-end justify-between gap-1 h-24 mb-1.5">
                      {LBI_MODULES.map(m => {
                        const active = activeLbiModule === m.code;
                        return (
                          <button
                            key={m.code}
                            onClick={() => setActiveLbiModule(active ? null : m.code)}
                            className="flex-1 flex flex-col items-center focus:outline-none"
                            title={m.name}
                          >
                            <span className="text-[8px] font-bold mb-0.5" style={{ color: active ? '#fff' : 'rgba(255,255,255,0.35)' }}>{m.score}%</span>
                            <div
                              className="w-full rounded-t-sm transition-all duration-300"
                              style={{
                                height: `${(m.score / 100) * 72}px`,
                                backgroundColor: '#fff',
                                opacity: active || !activeLbiModule ? (active ? 1 : 0.65) : 0.2,
                              }}
                            />
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex justify-between mb-4">
                      {LBI_MODULES.map(m => (
                        <span key={m.code} className="flex-1 text-center text-[8px] font-bold"
                          style={{ color: activeLbiModule === m.code ? '#fff' : 'rgba(255,255,255,0.25)' }}>{m.code}</span>
                      ))}
                    </div>
                    <div className="border-t pt-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">
                          {activeLbiModule ? `${activeLbiModule} — Domains` : 'Top Domains'}
                        </span>
                        {activeLbiModule && (
                          <button onClick={() => setActiveLbiModule(null)} className="text-[9px] font-bold text-white/40 hover:text-white/70 transition-colors">Clear ×</button>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        {filteredDoms.slice(0, 5).map(d => {
                          const DIcon = d.icon;
                          return (
                            <div key={d.id} className="flex items-center gap-2">
                              <DIcon className="h-3 w-3 flex-shrink-0 text-white/40" />
                              <span className="text-[10px] text-white/65 flex-1 truncate font-medium">{d.name}</span>
                              <span className="text-[9px] text-white/25">{d.subs} sub</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                      <span className="text-[10px] font-bold text-white/50">Composite: <b className="text-white">{LBI_COMPOSITE}%</b></span>
                      <span className="text-[9px] text-white/25 italic">Scores illustrative</span>
                    </div>
                  </div>
                )}

                {/* ── ERI panel ── */}
                {activeFramework === 'eri' && (
                  <div className="p-5">
                    <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-3">6 dimensions · click for detail</p>
                    <div className="space-y-2.5">
                      {ERI_DIMENSIONS.map(d => {
                        const active = activeEriDim === d.code;
                        return (
                          <div key={d.code}>
                            <button onClick={() => setActiveEriDim(active ? null : d.code)} className="w-full text-left focus:outline-none">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-black w-5 text-white/40">{d.code}</span>
                                  <span className="text-[10px] font-semibold text-white/70">{d.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] text-white/30">{d.indicators} ind.</span>
                                  <span className="text-[10px] font-black text-white">{d.score}</span>
                                </div>
                              </div>
                              <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                                <div className="h-full rounded-full transition-all" style={{ width: `${d.score}%`, backgroundColor: 'rgba(255,255,255,0.6)' }} />
                              </div>
                            </button>
                            {active && (
                              <div className="mt-1.5 ml-5 p-2 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
                                <p className="text-[10px] text-white/50 leading-relaxed">{d.desc}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 pt-3 border-t flex justify-between" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                      <span className="text-[10px] font-bold text-white/50">Composite: <b className="text-white">{ERI_COMPOSITE}%</b></span>
                      <span className="text-[9px] text-white/25 italic">Scores illustrative</span>
                    </div>
                  </div>
                )}

                {/* ── CIP panel ── */}
                {activeFramework === 'cip' && (
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Competency scores</p>
                      <div className="flex gap-1">
                        {CIP_STAGES.map(s => (
                          <button
                            key={s.stage}
                            onClick={() => setActiveCipStage(s.stage)}
                            className="text-[8px] px-1.5 py-0.5 rounded-full font-bold transition-all"
                            style={activeCipStage === s.stage
                              ? { backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }
                              : { backgroundColor: 'transparent', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}
                          >{s.stage}</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      {CIP_DOMAINS.map(d => {
                        const at = d.score >= cipThreshold;
                        return (
                          <div key={d.domain}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-semibold text-white/70">{d.domain}</span>
                              <div className="flex items-center gap-1.5">
                                {!at && <AlertTriangle className="h-2.5 w-2.5 text-white/40" />}
                                <span className="text-[10px] font-black text-white">{d.score}</span>
                              </div>
                            </div>
                            <div className="h-1 rounded-full overflow-hidden relative" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                              <div className="h-full rounded-full transition-all" style={{ width: `${d.score}%`, backgroundColor: at ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)' }} />
                              <div className="absolute top-0 bottom-0 w-px" style={{ left: `${cipThreshold}%`, backgroundColor: 'rgba(255,255,255,0.4)' }} />
                            </div>
                            {!at && <p className="text-[8px] text-white/30 mt-0.5">Gap: {cipThreshold - d.score} pts below threshold</p>}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 pt-3 border-t flex justify-between" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                      <span className="text-[10px] font-bold text-white/50">Composite: <b className="text-white">{CIP_COMPOSITE}%</b></span>
                      <span className="text-[9px] text-white/25 italic">Scores illustrative</span>
                    </div>
                  </div>
                )}

                <div
                  className="px-5 py-3 border-t flex items-center justify-between"
                  style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(0,0,0,0.15)' }}
                >
                  <p className="text-[10px] text-white/30 flex items-center gap-1"><Lock className="h-3 w-3" /> Sample data — your results are private</p>
                  <button onClick={() => onNavigate('registration')} className="text-[10px] font-bold text-white/50 hover:text-white flex items-center gap-0.5 transition-colors">
                    Get assessed <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            TRUST BAR
        ════════════════════════════════════════════════════════════════ */}
        <div className="border-b border-gray-100 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-7">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
              {[
                { icon: Users,     value: '50,000+', label: 'Profiles generated' },
                { icon: BarChart3, value: '3',       label: 'Assessment engines'  },
                { icon: Activity,  value: '97',      label: 'LBI subdomains'      },
                { icon: Star,      value: '4.9 / 5', label: 'Platform rating'     },
              ].map(({ icon: Icon, value, label }) => (
                <div key={label} className="flex flex-col items-center gap-1.5">
                  <Icon className="h-4 w-4 mb-0.5" style={{ color: N7 }} />
                  <p className="text-xl font-black" style={{ color: N2 }}>{value}</p>
                  <p className="text-[10px] text-gray-400 font-medium">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            LBI — deep-dive section
        ════════════════════════════════════════════════════════════════ */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          {/* Section heading */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="rounded-lg p-1.5" style={{ backgroundColor: NT }}>
                  <Brain className="h-4 w-4" style={{ color: N2 }} />
                </div>
                <h2 className="text-xl font-black" style={{ color: N0 }}>LBI™ — Learning Behavior Index</h2>
                <span
                  className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                  style={{ backgroundColor: NT, color: N2 }}
                >19 Domains · 97 Subdomains · 7 Modules</span>
              </div>
              <p className="text-xs text-gray-400 font-medium">The most comprehensive behavioral intelligence assessment for learners aged 6–18</p>
            </div>
            <Button
              variant="outline" size="sm"
              onClick={() => onNavigate('lbi-product')}
              className="text-xs flex-shrink-0 font-semibold"
              style={{ borderColor: N7, color: N2 }}
            >
              Full LBI™ Detail <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Module scores */}
            <div className="lg:col-span-2 border border-gray-100 rounded-2xl p-6 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-xs font-bold text-gray-700 mb-0.5">7 Assessment Modules</p>
                  <p className="text-[10px] text-gray-400">Illustrative scores · Actual results vary per individual</p>
                </div>
                <Ring score={LBI_COMPOSITE} size={60} />
              </div>
              <div className="space-y-3.5">
                {LBI_MODULES.map(m => (
                  <div key={m.code}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="text-[9px] font-black px-2 py-0.5 rounded-md text-white"
                          style={{ backgroundColor: m.color }}
                        >{m.code}</span>
                        <span className="text-xs font-semibold text-gray-700">{m.name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px]">
                        <span className="text-gray-400">{m.domains}d · {m.subs} sub</span>
                        <span className="font-black" style={{ color: m.color }}>{m.score}%</span>
                      </div>
                    </div>
                    <Bar score={m.score} color={m.color} />
                  </div>
                ))}
              </div>
            </div>

            {/* Age bands */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-600">Age-Band Calibration</p>
              {[
                { code: 'A', range: '6–10 yrs',  label: 'Primary',         color: N4, desc: 'Foundational learning patterns, basic cognitive habits, early behavioral indicators' },
                { code: 'B', range: '11–14 yrs', label: 'Middle School',    color: N2, desc: 'Developing critical thinking, emerging exam stress, peer comparison sensitivity' },
                { code: 'C', range: '15–18 yrs', label: 'Senior Secondary', color: N0, desc: 'Advanced cognitive load, competitive exam readiness, metacognitive maturity' },
              ].map(ab => (
                <div key={ab.code} className="border border-gray-100 rounded-2xl p-4 bg-white shadow-sm">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div
                      className="w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                      style={{ backgroundColor: ab.color }}
                    >{ab.code}</div>
                    <div>
                      <p className="text-xs font-bold" style={{ color: ab.color }}>{ab.label}</p>
                      <p className="text-[10px] text-gray-400">{ab.range}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed">{ab.desc}</p>
                </div>
              ))}
              <p className="text-[10px] text-gray-400 px-1">Questions, norms, and interpretations calibrated per age band</p>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            ERI — deep-dive section
        ════════════════════════════════════════════════════════════════ */}
        <div style={{ backgroundColor: NT }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
            <div className="flex items-start justify-between mb-8">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="rounded-lg p-1.5" style={{ backgroundColor: N8 }}>
                    <Sparkles className="h-4 w-4" style={{ color: N4 }} />
                  </div>
                  <h2 className="text-xl font-black" style={{ color: N0 }}>ERI™ — Exam Readiness Index</h2>
                  <span
                    className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                    style={{ backgroundColor: N8, color: N2 }}
                  >6 Dimensions · 24 Indicators · 3 Stages</span>
                </div>
                <p className="text-xs text-gray-400 font-medium">Psychometric assessment of exam-specific cognitive and behavioral readiness</p>
              </div>
              <Button
                variant="outline" size="sm"
                onClick={() => onNavigate('exam-ready')}
                className="text-xs flex-shrink-0 font-semibold bg-white"
                style={{ borderColor: N7, color: N2 }}
              >
                Full ERI™ Detail <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Dimension bars */}
              <div className="border border-gray-100 rounded-2xl p-6 bg-white shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-xs font-bold text-gray-700 mb-0.5">6 Dimensions</p>
                    <p className="text-[10px] text-gray-400">Illustrative scores</p>
                  </div>
                  <Ring score={ERI_COMPOSITE} size={60} />
                </div>
                <div className="space-y-4">
                  {ERI_DIMENSIONS.map(d => (
                    <div key={d.code}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="text-[9px] font-black px-2 py-0.5 rounded-md text-white"
                            style={{ backgroundColor: d.color }}
                          >{d.code}</span>
                          <span className="text-xs font-semibold text-gray-700">{d.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="text-gray-400">{d.indicators} ind.</span>
                          <span className="font-black" style={{ color: d.color }}>{d.score}%</span>
                        </div>
                      </div>
                      <Bar score={d.score} color={d.color} />
                      <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">{d.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Exam stages + ERI questions */}
              <div className="space-y-4">
                <div className="border border-gray-100 rounded-2xl p-5 bg-white shadow-sm">
                  <p className="text-xs font-bold text-gray-700 mb-4">3 Exam Readiness Stages</p>
                  {[
                    { stage: 'Pre-Exam',  color: N4, desc: 'Baseline readiness 4–6 weeks before. Reveals preparation gaps and stress trajectory.' },
                    { stage: 'Exam-Week', color: N2, desc: 'Real-time cognitive and emotional state. Identifies acute performance risks.' },
                    { stage: 'Post-Exam', color: N0, desc: 'Recovery analysis and next-exam calibration. Builds adaptive resilience over time.' },
                  ].map(s => (
                    <div key={s.stage} className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
                      <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: s.color }} />
                      <div>
                        <p className="text-xs font-bold mb-0.5" style={{ color: s.color }}>{s.stage}</p>
                        <p className="text-[10px] text-gray-500 leading-relaxed">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border border-gray-100 rounded-2xl p-5 bg-white shadow-sm">
                  <p className="text-xs font-bold text-gray-700 mb-3">What ERI™ answers</p>
                  {[
                    'Am I cognitively prepared for this exam right now?',
                    'Will exam anxiety limit my performance on the day?',
                    'How effectively do I execute exam strategy under pressure?',
                    'Am I able to recover from a difficult question and continue?',
                  ].map(q => (
                    <div key={q} className="flex items-start gap-2.5 py-2 text-xs text-gray-600 border-b border-gray-50 last:border-0">
                      <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: N2 }} />
                      <span>{q}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            CIP — deep-dive section
        ════════════════════════════════════════════════════════════════ */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="flex items-start justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="rounded-lg p-1.5" style={{ backgroundColor: NT }}>
                  <Gauge className="h-4 w-4" style={{ color: N1 }} />
                </div>
                <h2 className="text-xl font-black" style={{ color: N0 }}>CIP™ — Competency Intelligence Platform</h2>
                <span
                  className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                  style={{ backgroundColor: NT, color: N2 }}
                >50 Competencies · 7 Industries · 4 Stages</span>
              </div>
              <p className="text-xs text-gray-400 font-medium">Behavioral and role-competency intelligence for working professionals and enterprises</p>
            </div>
            <Button
              variant="outline" size="sm"
              onClick={() => onNavigate('competency-intelligence')}
              className="text-xs flex-shrink-0 font-semibold"
              style={{ borderColor: N7, color: N2 }}
            >
              Full CIP™ Detail <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Competency domains with threshold */}
            <div className="lg:col-span-2 border border-gray-100 rounded-2xl p-6 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-xs font-bold text-gray-700 mb-1.5">Key Competency Domains · select career stage</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {CIP_STAGES.map(s => (
                      <button
                        key={s.stage}
                        onClick={() => setActiveCipStage(s.stage)}
                        className="text-[9px] px-2.5 py-1 rounded-full font-bold transition-all"
                        style={activeCipStage === s.stage
                          ? { backgroundColor: N2, color: '#fff', border: `1px solid ${N2}` }
                          : { backgroundColor: '#fff', color: '#6b7280', border: '1px solid #e5e7eb' }}
                      >{s.stage} (≥{s.threshold})</button>
                    ))}
                  </div>
                </div>
                <Ring score={CIP_COMPOSITE} size={60} />
              </div>
              <div className="space-y-4">
                {CIP_DOMAINS.map((d, i) => {
                  const at = d.score >= cipThreshold;
                  const barColor = at ? SEQ[Math.min(i, SEQ.length - 1)] : N7;
                  const weightStyle: Record<string, { bg: string; color: string }> = {
                    Critical: { bg: `${N2}10`, color: N2 },
                    High:     { bg: `${N3}10`, color: N3 },
                    Medium:   { bg: `${N6}20`, color: N5 },
                  };
                  const ws = weightStyle[d.weight] || weightStyle.Medium;
                  return (
                    <div key={d.domain}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-700">{d.domain}</span>
                          <span
                            className="text-[8px] px-1.5 py-0.5 rounded-full font-bold"
                            style={{ backgroundColor: ws.bg, color: ws.color }}
                          >{d.weight}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          {!at && <AlertTriangle className="h-3 w-3" style={{ color: N6 }} />}
                          <span className="font-black" style={{ color: at ? N2 : N7 }}>{d.score}</span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden relative" style={{ backgroundColor: N8 }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${d.score}%`, backgroundColor: barColor }}
                        />
                        <div className="absolute top-0 bottom-0 w-px" style={{ left: `${cipThreshold}%`, backgroundColor: N2, opacity: 0.4 }} />
                      </div>
                      {!at && <p className="text-[9px] mt-0.5" style={{ color: N7 }}>Gap: {cipThreshold - d.score} pts below {activeCipStage} threshold</p>}
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-gray-400 mt-4 italic">Vertical tick = stage threshold · Scores illustrative</p>
            </div>

            {/* Industries + capabilities */}
            <div className="space-y-4">
              <div className="border border-gray-100 rounded-2xl p-5 bg-white shadow-sm">
                <p className="text-xs font-bold text-gray-700 mb-3">7 Industry Cohorts</p>
                {[
                  { industry: 'Technology',        roles: '28+' },
                  { industry: 'Financial Services', roles: '22+' },
                  { industry: 'Healthcare',         roles: '18+' },
                  { industry: 'Consulting',         roles: '15+' },
                  { industry: 'Manufacturing',      roles: '20+' },
                  { industry: 'Education',          roles: '12+' },
                  { industry: 'Government',         roles: '10+' },
                ].map((ind, i) => (
                  <div key={ind.industry} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: SEQ[i % SEQ.length] }} />
                      <span className="text-gray-700 font-medium">{ind.industry}</span>
                    </div>
                    <span className="text-gray-400 text-[10px]">{ind.roles} roles</span>
                  </div>
                ))}
              </div>

              <div className="border border-gray-100 rounded-2xl p-5 bg-white shadow-sm">
                <p className="text-xs font-bold text-gray-700 mb-3">CIP™ Core Capabilities</p>
                {[
                  'Gap analysis vs. role requirements',
                  'Hiring prediction probability score',
                  'Role transition readiness report',
                  'Growth simulation trajectory',
                  'Career stage progression mapping',
                  'Industry percentile benchmarking',
                ].map(cap => (
                  <div key={cap} className="flex items-center gap-2.5 py-1.5 border-b border-gray-50 last:border-0 text-xs text-gray-600">
                    <CheckCircle className="h-3 w-3 flex-shrink-0" style={{ color: N2 }} />
                    <span>{cap}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            COMPARISON TABLE
        ════════════════════════════════════════════════════════════════ */}
        <div style={{ backgroundColor: NT }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
            <div className="mb-6">
              <h2 className="text-xl font-black mb-1" style={{ color: N0 }}>Framework comparison at a glance</h2>
              <p className="text-xs text-gray-400 font-medium">How the three engines differ in audience, structure, and primary output</p>
            </div>
            <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: `linear-gradient(90deg, ${N0} 0%, ${N2} 100%)` }}>
                    <th className="text-left py-3 px-5 text-[10px] font-bold text-white/50 uppercase tracking-wide w-36">Dimension</th>
                    {frameworks.map(f => (
                      <th key={f.id} className="py-3 px-5 text-center text-[11px] font-black text-white">{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { dim: 'Primary audience',   lbi: 'Students 6–18',              eri: 'Exam candidates',         cip: 'Working professionals' },
                    { dim: 'Assessment time',    lbi: '45–60 min',                  eri: '30–40 min',               cip: '35–50 min'            },
                    { dim: 'Structure',          lbi: '7 modules / 19 domains',      eri: '6 dimensions',            cip: '50 competencies'       },
                    { dim: 'Sub-units',          lbi: '97 subdomains',              eri: '24 indicators',           cip: '7 industry cohorts'    },
                    { dim: 'Primary output',     lbi: 'Behavioral intelligence profile', eri: 'Exam readiness score', cip: 'Role-fit & hiring probability' },
                    { dim: 'Compliance',         lbi: 'DPDP · GDPR · SOC 2',        eri: 'GDPR · SOC 2',           cip: 'GDPR · SOC 2 Type II'  },
                    { dim: 'Re-assessment',      lbi: 'Annual / biannual',           eri: 'Per exam cycle',          cip: 'Per role / quarterly'  },
                  ].map((row, i) => (
                    <tr key={row.dim} style={{ backgroundColor: i % 2 === 0 ? '#fff' : NT }}>
                      <td className="py-2.5 px-5 font-bold text-[10px] uppercase tracking-wide" style={{ color: N4 }}>{row.dim}</td>
                      <td className="py-2.5 px-5 text-center text-gray-700">{row.lbi}</td>
                      <td className="py-2.5 px-5 text-center text-gray-700">{row.eri}</td>
                      <td className="py-2.5 px-5 text-center text-gray-700">{row.cip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            TESTIMONIALS
        ════════════════════════════════════════════════════════════════ */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest text-center mb-6">What practitioners say</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { quote: 'The LBI report for my son was the first time we genuinely understood why he was underperforming despite working hard. It wasn\'t effort — it was stress regulation and metacognition. Within two months of targeted support, his scores improved significantly.', name: 'Geeta M.',   role: 'Parent of a Class 11 student',    framework: 'LBI™', shade: N2 },
              { quote: 'I had three JEE attempts ahead of me. The ERI told me my cognitive preparedness was strong but my exam execution strategy was weak — specifically question sequencing. I changed my approach and improved my percentile by 12 points in the next mock series.',   name: 'Arjun S.',  role: 'JEE Aspirant',                    framework: 'ERI™', shade: N4 },
              { quote: 'We use the CIP to screen candidates before final interviews. It surfaces competency gaps that structured interviews miss — especially strategic thinking and people leadership at the Director level. It\'s now embedded in our hiring SOP.',                         name: 'Rebecca O.', role: 'Head of Talent, Enterprise SaaS', framework: 'CIP™', shade: N1 },
            ].map(t => (
              <div key={t.name} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-3 w-3" style={{ fill: N2, color: N2 }} />
                    ))}
                  </div>
                  <span
                    className="text-[9px] font-black px-2.5 py-0.5 rounded-full"
                    style={{ backgroundColor: NT, color: t.shade }}
                  >{t.framework}</span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed flex-1 italic">"{t.quote}"</p>
                <div className="border-t border-gray-100 mt-4 pt-3">
                  <p className="text-xs font-bold" style={{ color: N2 }}>{t.name}</p>
                  <p className="text-[10px] text-gray-400">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            CTA — dark navy gradient
        ════════════════════════════════════════════════════════════════ */}
        <div style={{ background: `linear-gradient(135deg, ${N0} 0%, ${N1} 50%, ${N2} 100%)` }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <div>
                <h3 className="text-2xl font-black text-white mb-3 leading-tight">
                  Choose your assessment engine
                </h3>
                <p className="text-sm text-white/50 leading-relaxed mb-7 max-w-lg">
                  Whether you are a student seeking behavioral clarity, an exam candidate preparing for a high-stakes test, or a working professional targeting the next role — MetryxOne has a validated intelligence engine built for your context.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => onNavigate('registration')}
                    className="px-7 font-bold text-sm border-0"
                    style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: '#fff' }}
                  >
                    Get Started <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onNavigate('request-demo')}
                    className="px-7 font-semibold text-sm"
                    style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.65)', backgroundColor: 'transparent' }}
                  >
                    Request Enterprise Demo
                  </Button>
                </div>
                <p className="text-[10px] text-white/25 mt-4 flex items-center gap-1">
                  <Shield className="h-3 w-3" /> SOC 2 Type II · GDPR compliant · Data never sold
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {frameworks.map(f => (
                  <div
                    key={f.id}
                    className="rounded-2xl p-5 flex flex-col items-center text-center"
                    style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.1)' }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                      style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                    >
                      <f.icon className="h-5 w-5 text-white" />
                    </div>
                    <p className="text-base font-black text-white mb-0.5">{f.label}</p>
                    <p className="text-[10px] text-white/40 font-medium leading-tight">{f.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </main>
      <Footer onNavigate={onNavigate} />
    </div>
  );
}
