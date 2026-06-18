import { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Sparkles, Brain, Heart, Shield, Clock, Users, ArrowRight, CheckCircle,
  BarChart3, Target, Lightbulb, Zap, Star, Eye, BookOpen, Activity,
  Cpu, Compass, TrendingUp, Layers, RefreshCw, Award, ChevronDown,
  Play, Lock, AlertTriangle, Minus, Plus
} from "lucide-react";

// ── MetryxOne brand palette ───────────────────────────────────────────────────
const B = {
  blue:   '#0B3C5D',   // Intelligence Blue
  green:  '#4ECDC4',   // Insight Green
  blueMid: '#1A4F7A',  // gradient mid
  amber:  '#D97706',
  red:    '#DC2626',
  indigo: '#1B6B9A',
  pink:   '#1D8055',
};

// ── Data ──────────────────────────────────────────────────────────────────────
const ASSESSMENT_MODULES = [
  { id: 'M01', name: 'Stress Management & Coping',      subdomains: 4, icon: Activity,  desc: 'Exam pressure tolerance, anxiety triggers, coping mechanisms, and recovery speed',                          color: B.blue },
  { id: 'M02', name: 'Focus & Sustained Attention',     subdomains: 3, icon: Target,    desc: 'Concentration durability, distraction resistance, and task-switching under pressure',                      color: B.indigo },
  { id: 'M03', name: 'Confidence & Self-Belief',        subdomains: 4, icon: Star,      desc: 'Performance self-efficacy, pre-exam confidence, stability under doubt, and attribution patterns',         color: B.amber },
  { id: 'M04', name: 'Emotional Regulation',            subdomains: 3, icon: Heart,     desc: 'Pre-exam emotional control, mid-exam composure, and post-exam processing patterns',                       color: B.pink },
  { id: 'M05', name: 'Study Strategy & Habits',         subdomains: 5, icon: BookOpen,  desc: 'Revision effectiveness, time management, plan adherence, spaced repetition, and active recall',           color: B.green },
  { id: 'M06', name: 'Social & Environmental Factors',  subdomains: 3, icon: Users,     desc: 'Peer comparison pressure, parental expectations, and support system effectiveness',                       color: '#4ECDC4' },
];

const READINESS_DIMENSIONS = [
  { icon: Brain,     title: 'Mental Preparedness',      desc: 'Cognitive readiness, processing speed under time constraints, and mental stamina',              color: B.blue   },
  { icon: Heart,     title: 'Emotional Resilience',     desc: 'Manage anxiety, maintain composure, and channel stress productively during exams',              color: B.pink   },
  { icon: Shield,    title: 'Pressure Tolerance',       desc: 'Handle setbacks, time pressure, unexpected questions, and competitive environments',            color: B.green  },
  { icon: Target,    title: 'Strategic Thinking',       desc: 'Question prioritization, time allocation, and exam navigation strategies',                      color: B.amber  },
  { icon: Lightbulb, title: 'Metacognitive Awareness',  desc: 'Self-monitoring during exams — knowing what you know and skipping strategically',               color: B.indigo },
  { icon: Star,      title: 'Confidence Calibration',   desc: 'Alignment between self-assessed readiness and actual preparedness level',                       color: '#4ECDC4'},
];

const REPORT_TYPES = [
  { name: 'Readiness Score Report',   desc: 'Overall exam readiness percentile across all 6 modules',    tier: 'All Plans', icon: BarChart3, ai: false },
  { name: 'AI Root Cause Analysis',   desc: 'Cross-module AI identifies hidden patterns',                tier: 'Starter+',  icon: Cpu,       ai: true  },
  { name: 'Personalized Action Plan', desc: 'AI-generated 30-day improvement roadmap',                   tier: 'Starter+',  icon: Compass,   ai: true  },
  { name: 'Trend & Progress Report',  desc: 'Longitudinal tracking across assessment cycles',             tier: 'Starter+',  icon: TrendingUp,ai: true  },
  { name: 'Comparative Benchmark',    desc: 'Performance benchmarked against peer cohorts',               tier: 'Starter+',  icon: Layers,    ai: true  },
];

interface ExamReadinessPageProps {
  role?: 'parent' | 'institute';
  onStartAssessment?: () => void;
}

export function ExamReadinessPage({ role = 'parent', onStartAssessment }: ExamReadinessPageProps) {
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const totalSubdomains = ASSESSMENT_MODULES.reduce((s, m) => s + m.subdomains, 0);

  return (
    <div className="space-y-8" style={{ fontFamily: 'Inter, sans-serif' }} data-testid="exam-readiness-page">

      {/* ── Hero banner ──────────────────────────────────────────────────── */}
      <div
        className="relative rounded-2xl overflow-hidden shadow-sm"
        style={{ background: `${B.blue}` }}
        data-testid="exam-readiness-hero"
      >
        {/* decorative circles */}
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white opacity-[0.03]" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-white opacity-[0.03]" />

        <div className="relative p-6 md:p-8">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            {/* left */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase bg-white/10 text-white/80">
                  <Clock size={10} /> 30–40 Min
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase bg-white/10 text-white/80">
                  Ages 10–18
                </span>
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase"
                  style={{ background: `${B.green}25`, color: B.green }}
                >
                  <Sparkles size={9} /> New
                </span>
              </div>

              <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight tracking-tight mb-2">
                ExamReadiness <span style={{ color: B.green }}>Index</span>
                <span className="text-white/30 font-light text-xl ml-1">™</span>
              </h1>
              <p className="text-[13px] text-white/80 font-semibold mb-1.5">
                Measure Psychological Exam Readiness, Not Academic Knowledge
              </p>
              <p className="text-[11px] text-white/50 mb-5 leading-relaxed max-w-md">
                Reveals whether a student is mentally, emotionally, and strategically prepared to
                perform at their best — regardless of how much they've studied.
              </p>

              <div className="mb-5">
                <Button
                  className="text-white font-semibold h-9 px-6 text-[12px] rounded-xl shadow"
                  style={{ backgroundColor: B.green }}
                  onClick={onStartAssessment}
                  data-testid="button-start-exam-readiness"
                >
                  Start Assessment <ArrowRight size={13} className="ml-1.5" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] text-white/50">
                {[
                  { icon: CheckCircle, label: 'Non-Diagnostic' },
                  { icon: Shield,      label: 'DPDP Compliant' },
                  { icon: Cpu,         label: 'AI-Powered Reports' },
                  { icon: Lock,        label: '256-bit Encrypted' },
                ].map((item, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <item.icon size={10} style={{ color: B.green }} /> {item.label}
                  </span>
                ))}
              </div>
            </div>

            {/* right — stat grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: '6',       label: 'Modules',      sub: `${totalSubdomains} subdomains` },
                { value: '100+',    label: 'Questions',    sub: 'age-adaptive'   },
                { value: '5',       label: 'Report Types', sub: 'AI-powered'     },
                { value: 'Instant', label: 'Analysis',     sub: 'real-time AI'   },
              ].map((stat, idx) => (
                <div key={idx} className="bg-white/[0.08] rounded-xl px-4 py-3.5 text-center" data-testid={`stat-card-${idx}`}>
                  <p className="text-2xl font-bold text-white tracking-tight">{stat.value}</p>
                  <p className="text-[11px] font-semibold text-white/70 mt-0.5">{stat.label}</p>
                  <p className="text-[10px] text-white/35 mt-0.5">{stat.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Feature strip ────────────────────────────────────────────────── */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 divide-x rounded-2xl border"
        style={{ borderColor: 'rgba(11,60,93,0.1)', divideColor: 'rgba(11,60,93,0.08)' }}
      >
        {[
          { icon: Brain,    label: 'Beyond Academics', text: 'Measures readiness, not knowledge'    },
          { icon: Sparkles, label: 'AI-Powered',        text: '5 report types with AI insights'     },
          { icon: Activity, label: 'Behavioral Focus',  text: 'Psychological preparedness'          },
          { icon: Shield,   label: 'Privacy First',     text: 'DPDP compliant, encrypted'           },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-2.5 px-4 py-3.5 bg-white first:rounded-l-2xl last:rounded-r-2xl">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${B.blue}08` }}>
              <item.icon size={14} style={{ color: B.blue }} />
            </div>
            <div>
              <p className="text-[11px] font-bold" style={{ color: B.blue }}>{item.label}</p>
              <p className="text-[10px] text-gray-400 leading-snug">{item.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── 6 Dimensions ─────────────────────────────────────────────────── */}
      <div>
        <div className="text-center mb-6">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: B.green }}>
            What We Measure
          </p>
          <h2 className="text-lg md:text-xl font-bold tracking-tight" style={{ color: B.blue }}>
            6 Dimensions of Exam Readiness
          </h2>
          <p className="text-[11px] text-gray-500 mt-1 max-w-lg mx-auto leading-relaxed">
            Not how much your child has studied — but whether they're psychologically prepared to perform
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="readiness-dimensions">
          {READINESS_DIMENSIONS.map((dim, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl border p-4 hover:shadow-sm transition-all"
              style={{ borderColor: 'rgba(11,60,93,0.08)' }}
              data-testid={`dimension-card-${idx}`}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${dim.color}12` }}>
                  <dim.icon size={17} style={{ color: dim.color }} />
                </div>
                <div>
                  <h3 className="font-bold text-[12px] mb-1" style={{ color: B.blue }}>{dim.title}</h3>
                  <p className="text-[10px] leading-relaxed text-gray-500">{dim.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 6 Modules accordion ──────────────────────────────────────────── */}
      <div className="rounded-2xl p-5" style={{ background: 'rgba(11,60,93,0.03)', border: `1px solid rgba(11,60,93,0.07)` }}>
        <div className="mb-5">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: B.green }}>
            Comprehensive Framework
          </p>
          <h2 className="text-lg md:text-xl font-bold tracking-tight" style={{ color: B.blue }}>
            6 Modules. {totalSubdomains} Subdomains.
          </h2>
          <p className="text-[11px] text-gray-500 mt-1">
            Every behavioral factor that influences exam performance, measured with scientific precision.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
          {ASSESSMENT_MODULES.map((module) => {
            const expanded = expandedModule === module.id;
            return (
              <div
                key={module.id}
                className="rounded-xl border cursor-pointer transition-all"
                style={{
                  borderColor: expanded ? module.color : 'rgba(11,60,93,0.08)',
                  backgroundColor: expanded ? `${module.color}05` : '#ffffff',
                }}
                onClick={() => setExpandedModule(expanded ? null : module.id)}
                data-testid={`module-card-${module.id}`}
              >
                <div className="p-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${module.color}12` }}>
                      <module.icon size={14} style={{ color: module.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[8px] font-bold px-1 py-0.5 rounded" style={{ background: `${module.color}15`, color: module.color }}>{module.id}</span>
                        <span className="text-[9px] text-gray-400">{module.subdomains} sub</span>
                      </div>
                      <h3 className="font-semibold text-[11px] leading-tight text-gray-800">{module.name}</h3>
                    </div>
                    <ChevronDown
                      size={11}
                      className="shrink-0 mt-0.5 text-gray-300 transition-transform"
                      style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
                    />
                  </div>
                  {expanded && (
                    <div className="mt-2 pt-2 border-t" style={{ borderColor: 'rgba(11,60,93,0.06)' }}>
                      <p className="text-[10px] leading-relaxed text-gray-500">{module.desc}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-center mt-4 text-[10px] text-gray-400">
          Powered by the LBI Engine. Scores are age-calibrated and norm-referenced.
        </p>
      </div>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <div>
        <div className="text-center mb-6">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: B.green }}>
            Assessment Process
          </p>
          <h2 className="text-lg md:text-xl font-bold tracking-tight" style={{ color: B.blue }}>
            How It Works
          </h2>
          <p className="text-[11px] text-gray-500 mt-1">
            From consent to actionable readiness insights in four steps
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { step: 1, title: 'Consent & Setup',        desc: 'Parent provides DPDP-compliant consent. Student profile created.',                         icon: Shield  },
            { step: 2, title: 'Behavioral Assessment',  desc: 'Age-appropriate questions across 6 readiness modules. 30–40 min.',                         icon: Brain   },
            { step: 3, title: 'AI Analysis',            desc: 'Proprietary scoring engine identifies root causes of exam anxiety.',                        icon: Cpu     },
            { step: 4, title: 'Readiness Report',       desc: 'Module scores, readiness index, and personalized strategies.',                              icon: BarChart3 },
          ].map((step) => (
            <div key={step.step} className="relative text-center" data-testid={`step-${step.step}`}>
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm mx-auto mb-3"
                style={{ background: `${B.blue}` }}
              >
                {step.step}
              </div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ background: `${B.green}12` }}>
                <step.icon size={17} style={{ color: B.green }} />
              </div>
              <h3 className="font-bold text-[11px] mb-1" style={{ color: B.blue }}>{step.title}</h3>
              <p className="text-[10px] text-gray-500 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Sample Report ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl p-5" style={{ background: 'rgba(11,60,93,0.03)', border: '1px solid rgba(11,60,93,0.07)' }}>
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: B.green }}>
              Sample Report
            </p>
            <h2 className="text-lg md:text-xl font-bold tracking-tight" style={{ color: B.blue }}>
              What Your Report Reveals
            </h2>
            <p className="text-[11px] text-gray-500 mt-1">
              Deep, actionable intelligence into your child's exam readiness
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-4">
          {/* Module scorecard */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl border p-5 h-full" style={{ borderColor: 'rgba(11,60,93,0.08)' }}>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: `${B.blue}08` }}>
                  <BarChart3 size={15} style={{ color: B.blue }} />
                </div>
                <div>
                  <h3 className="font-bold text-[12px]" style={{ color: B.blue }}>Module-Level Scorecard</h3>
                  <p className="text-[10px] text-gray-400">Percentile scores across readiness modules</p>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { domain: 'M01 · Stress Management',    score: 58, color: B.amber  },
                  { domain: 'M02 · Focus & Attention',    score: 72, color: B.indigo },
                  { domain: 'M03 · Confidence',           score: 45, color: B.red    },
                  { domain: 'M04 · Emotional Regulation', score: 67, color: B.pink   },
                  { domain: 'M05 · Study Strategy',       score: 83, color: B.green  },
                  { domain: 'M06 · Social & Environment', score: 61, color: '#4ECDC4'},
                ].map((item, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="font-medium text-gray-600">{item.domain}</span>
                      <span className="font-bold tabular-nums" style={{ color: item.color }}>
                        {item.score}<span className="text-[9px] font-normal text-gray-300">/100</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100">
                      <div className="h-full rounded-full transition-all" style={{ width: `${item.score}%`, backgroundColor: item.color }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] mt-4 pt-3 italic text-gray-400 border-t" style={{ borderColor: 'rgba(11,60,93,0.06)' }}>
                Sample data. Actual reports include all 6 modules with subdomain breakdowns.
              </p>
            </div>
          </div>

          {/* Key Insights */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border p-5 h-full" style={{ borderColor: 'rgba(11,60,93,0.08)' }}>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: `${B.green}12` }}>
                  <Lightbulb size={15} style={{ color: B.green }} />
                </div>
                <div>
                  <h3 className="font-bold text-[12px]" style={{ color: B.blue }}>Key Insights</h3>
                  <p className="text-[10px] text-gray-400">AI-generated analysis</p>
                </div>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: 'Root Cause', text: 'Low confidence (M03) is amplifying stress reactivity (M01), creating exam anxiety.',    type: 'alert'   },
                  { label: 'Strength',   text: 'Strong study habits (M05) with consistent revision patterns.',                         type: 'success' },
                  { label: 'Action Plan',text: 'Confidence-building with mock exam desensitization. 21-day window.',                   type: 'action'  },
                  { label: 'Key Finding',text: 'Knows material but underperforms due to psychological barriers.',                       type: 'warning' },
                ].map((insight, idx) => {
                  const C = {
                    alert:   { bg: '#FEF2F2', border: B.red,   text: B.red   },
                    success: { bg: '#F0FDF4', border: B.green, text: B.green },
                    warning: { bg: '#FFFBEB', border: B.amber, text: B.amber },
                    action:  { bg: `${B.blue}06`, border: B.blue, text: B.blue },
                  }[insight.type as 'alert'|'success'|'warning'|'action'];
                  return (
                    <div key={idx} className="p-3 rounded-xl border-l-[3px]" style={{ backgroundColor: C.bg, borderLeftColor: C.border }}>
                      <p className="text-[8px] font-bold uppercase tracking-widest mb-0.5" style={{ color: C.text }}>{insight.label}</p>
                      <p className="text-[10px] leading-relaxed text-gray-600">{insight.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 5 Report Types ───────────────────────────────────────────────── */}
      <div>
        <div className="text-center mb-6">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: B.green }}>
            AI-Powered Intelligence
          </p>
          <h2 className="text-lg md:text-xl font-bold tracking-tight" style={{ color: B.blue }}>
            5 Report Types. AI-Powered.
          </h2>
          <p className="text-[11px] text-gray-500 mt-1 max-w-lg mx-auto">
            Go beyond basic scores with AI-driven analysis
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {REPORT_TYPES.map((report, idx) => (
            <div key={idx} className="bg-white rounded-2xl border overflow-hidden hover:shadow-sm transition-all" style={{ borderColor: 'rgba(11,60,93,0.08)' }} data-testid={`report-type-${idx}`}>
              {report.ai && <div className="h-0.5" style={{ background: `${B.blue}` }} />}
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: report.ai ? `${B.green}12` : `${B.blue}08` }}>
                    <report.icon size={16} style={{ color: report.ai ? B.green : B.blue }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-[11px]" style={{ color: B.blue }}>{report.name}</h3>
                      {report.ai && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider" style={{ background: `${B.green}15`, color: B.green }}>
                          <Sparkles size={7} /> AI
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] leading-relaxed text-gray-500 mb-2">{report.desc}</p>
                    <span
                      className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: report.ai ? `${B.amber}12` : `${B.green}12`, color: report.ai ? B.amber : B.green }}
                    >
                      {report.tier}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Unlock AI Reports */}
          <div
            className="rounded-2xl border-2 border-dashed p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-sm transition-all"
            style={{ borderColor: `${B.green}35`, background: `${B.green}04` }}
            onClick={onStartAssessment}
            data-testid="btn-upgrade-ai-reports"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2" style={{ background: `${B.green}12` }}>
              <Zap size={19} style={{ color: B.green }} />
            </div>
            <p className="font-bold text-[11px] mb-1" style={{ color: B.blue }}>Unlock AI Reports</p>
            <p className="text-[10px] text-gray-500 mb-2 leading-snug">Available on Starter plan and above</p>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold" style={{ color: B.green }}>
              Upgrade <ArrowRight size={10} />
            </span>
          </div>
        </div>
      </div>

      {/* ── Institute-only block ─────────────────────────────────────────── */}
      {role === 'institute' && (
        <div className="rounded-2xl p-5" style={{ background: 'rgba(11,60,93,0.03)', border: '1px solid rgba(11,60,93,0.07)' }}>
          <div className="text-center mb-5">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: B.green }}>
              For Institutes
            </p>
            <h2 className="text-lg md:text-xl font-bold tracking-tight" style={{ color: B.blue }}>
              Deploy Across Your Student Body
            </h2>
            <p className="text-[11px] text-gray-500 mt-1 max-w-md mx-auto">
              Identify at-risk students early and provide targeted intervention before exam season
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Users,        title: 'Bulk Assessment',   desc: 'Assess entire batches with a single click',              color: B.blue  },
              { icon: BarChart3,    title: 'Cohort Analytics',  desc: 'Compare readiness across sections and grades',           color: B.green },
              { icon: AlertTriangle,title: 'Early Intervention',desc: 'Flag students who need support before exams',            color: B.amber },
            ].map((item, idx) => (
              <div key={idx} className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: 'rgba(11,60,93,0.08)' }}>
                <div className="h-0.5" style={{ backgroundColor: item.color }} />
                <div className="p-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${item.color}12` }}>
                    <item.icon size={17} style={{ color: item.color }} />
                  </div>
                  <h3 className="font-bold text-[11px] mb-1" style={{ color: B.blue }}>{item.title}</h3>
                  <p className="text-[10px] text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CTA footer ───────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden shadow-sm"
        style={{ background: `${B.blue}` }}
      >
        <div className="relative p-8 text-center">
          <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-white opacity-[0.03]" />
          <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-white opacity-[0.03]" />
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <Target size={20} className="text-white" />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white mb-2 tracking-tight leading-tight">
              Is Your Child Ready to <span style={{ color: B.green }}>Perform at Their Best?</span>
            </h2>
            <p className="text-white/50 mb-5 text-[11px] max-w-sm mx-auto leading-relaxed">
              Go beyond academic preparation. Understand the psychological factors that determine exam performance.
            </p>
            <Button
              className="h-9 px-8 font-semibold text-[12px] rounded-xl text-white shadow"
              style={{ backgroundColor: B.green }}
              onClick={onStartAssessment}
              data-testid="btn-cta-start"
            >
              Start Assessment <ArrowRight size={13} className="ml-1.5" />
            </Button>
            <div className="flex flex-wrap justify-center gap-5 mt-4 text-white/40 text-[10px]">
              <span className="flex items-center gap-1.5"><Clock size={10} /> 30–40 minutes</span>
              <span className="flex items-center gap-1.5"><Shield size={10} /> Non-diagnostic</span>
              <span className="flex items-center gap-1.5"><Sparkles size={10} /> AI-Powered Reports</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
