import { BRAND_NAVY as BRAND } from '@/design-system/tokens';
import { useState } from 'react';
import {
  Brain, CheckCircle, ChevronDown, Clock, Shield, ArrowRight, Target,
  BookOpen, Users, FileText, Award, Lightbulb, Zap, BarChart3, Lock,
  Heart, Eye, AlertTriangle, Cpu, Star, UserCheck, Timer, Activity,
  Sparkles, TrendingUp, Layers, RefreshCw, Compass, Play, MessageSquare,
  ClipboardList, Minus, Plus
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { BotWidget } from '../components/BotWidget';

interface Props {
  onNavigate: (screen: string) => void;
}



const ASSESSMENT_MODULES = [
  { id: 'M01', name: 'Stress Management & Coping', subdomains: 4, icon: Activity, desc: 'Exam pressure tolerance, anxiety triggers, coping mechanisms, and recovery speed', color: BRAND.primary },
  { id: 'M02', name: 'Focus & Sustained Attention', subdomains: 3, icon: Target, desc: 'Concentration durability, distraction resistance, and task-switching under pressure', color: '#0B3C5D' },
  { id: 'M03', name: 'Confidence & Self-Belief', subdomains: 4, icon: Star, desc: 'Performance self-efficacy, pre-exam confidence, stability under doubt, and attribution patterns', color: BRAND.orange },
  { id: 'M04', name: 'Emotional Regulation', subdomains: 3, icon: Heart, desc: 'Pre-exam emotional control, mid-exam composure, and post-exam processing patterns', color: '#4ECDC4' },
  { id: 'M05', name: 'Study Strategy & Habits', subdomains: 5, icon: BookOpen, desc: 'Revision effectiveness, time management, plan adherence, spaced repetition, and active recall', color: BRAND.accent },
  { id: 'M06', name: 'Social & Environmental Factors', subdomains: 3, icon: Users, desc: 'Peer comparison pressure, parental expectations, and support system effectiveness', color: BRAND.green },
];

const READINESS_DIMENSIONS = [
  { icon: Brain, title: 'Mental Preparedness', desc: 'Cognitive readiness, processing speed under time constraints, and mental stamina for long exams', color: BRAND.primary },
  { icon: Heart, title: 'Emotional Resilience', desc: 'Ability to manage anxiety, maintain composure, and channel stress productively during exams', color: '#4ECDC4' },
  { icon: Shield, title: 'Pressure Tolerance', desc: 'Capacity to handle setbacks, time pressure, unexpected questions, and competitive environments', color: BRAND.accent },
  { icon: Target, title: 'Strategic Thinking', desc: 'Question prioritization, time allocation, difficulty assessment, and exam navigation strategies', color: BRAND.orange },
  { icon: Lightbulb, title: 'Metacognitive Awareness', desc: 'Self-monitoring during exams — knowing what you know, skipping strategically, and reviewing efficiently', color: BRAND.purple },
  { icon: Star, title: 'Confidence Calibration', desc: 'Alignment between self-assessed readiness and actual preparedness — avoiding overconfidence and under-confidence', color: BRAND.green },
];

const REPORT_TYPES = [
  { name: 'Readiness Score Report', desc: 'Overall exam readiness percentile across all 6 modules with dimension breakdowns', tier: 'All Plans', icon: BarChart3 },
  { name: 'AI Root Cause Analysis', desc: 'Cross-module AI identifies hidden patterns causing underperformance', tier: 'Starter+', icon: Cpu, ai: true },
  { name: 'Personalized Action Plan', desc: 'AI-generated 30-day improvement roadmap with daily micro-goals', tier: 'Starter+', icon: Compass, ai: true },
  { name: 'Trend & Progress Report', desc: 'Longitudinal tracking across multiple assessment cycles', tier: 'Starter+', icon: TrendingUp, ai: true },
  { name: 'Comparative Benchmark Report', desc: 'Performance benchmarked against age-matched peer cohorts', tier: 'Starter+', icon: Layers, ai: true },
];

const HOW_IT_WORKS = [
  { step: 1, title: 'Consent & Setup', desc: 'Parent provides DPDP-compliant consent. Student profile created with age verification.', icon: Shield },
  { step: 2, title: 'Behavioral Assessment', desc: 'Age-appropriate questions across 6 readiness modules. Adaptive difficulty. Takes 30-40 min.', icon: Brain },
  { step: 3, title: 'AI Analysis', desc: 'Proprietary scoring engine. Cross-module correlation identifies root causes of exam anxiety.', icon: Cpu },
  { step: 4, title: 'Readiness Report', desc: 'Module scores, dimension breakdowns, readiness index, and personalized strategies.', icon: BarChart3 },
];

const FAQS = [
  { question: 'What is ExamReadiness Index™?', answer: 'ExamReadiness Index™ is an LBI-based behavioral assessment that measures psychological exam readiness — not academic knowledge. It evaluates whether a student is mentally, emotionally, and strategically prepared to perform at their best, regardless of how much they\'ve studied.' },
  { question: 'How is this different from mock tests?', answer: 'Mock tests measure subject knowledge. ExamReadiness Index™ measures the psychological and behavioral factors that determine whether knowledge translates to performance — stress management, focus, confidence, emotional regulation, and exam strategy.' },
  { question: 'Who can take this assessment?', answer: 'Students aged 10-18 years. Parental consent is mandatory for all minors as per DPDP Act compliance. The assessment adapts to the student\'s age group automatically.' },
  { question: 'What are AI-Powered Reports?', answer: 'AI-Powered Reports use advanced analysis to identify cross-module patterns, generate personalized action plans, and benchmark against peer cohorts. Available on Starter plan and above.' },
  { question: 'Is this a diagnostic tool?', answer: 'No. ExamReadiness Index™ is a behavioral assessment tool that provides insights and recommendations. It is not a clinical or medical diagnostic tool. For mental health concerns, please consult a qualified professional.' },
  { question: 'Can the assessment be retaken?', answer: 'Yes, but we recommend a minimum gap of 3-6 months between assessments to allow for meaningful behavioral changes and to avoid assessment fatigue.' },
];

export function LandingPage({ onNavigate }: Props) {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  const totalSubdomains = ASSESSMENT_MODULES.reduce((sum, m) => sum + m.subdomains, 0);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#ffffff' }}>
      <Navbar onNavigate={onNavigate} currentScreen="exam-ready" />

      <main className="flex-1 pt-16">

        <section className="relative py-14 md:py-18 px-4 overflow-hidden" style={{ backgroundColor: BRAND.primary }} data-testid="exam-ready-hero">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full opacity-[0.04] bg-white" />
            <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full opacity-[0.03] bg-white" />
          </div>

          <div className="max-w-6xl mx-auto relative">
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              <div>
                <div className="flex items-center gap-2 mb-5">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-white/10 text-white/90">
                    <Clock size={11} className="mr-0.5" /> 30-40 Minutes
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-white/10 text-white/90">
                    Ages 10-18
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide uppercase" style={{ backgroundColor: 'rgba(78,205,196,0.2)', color: BRAND.accent }}>
                    <Sparkles size={10} /> New
                  </span>
                </div>

                <h1 className="text-3xl md:text-4xl font-bold text-white leading-[1.1] tracking-tight mb-3" data-testid="hero-title">
                  ExamReadiness <span style={{ color: BRAND.accent }}>Index</span><span className="text-white/30 font-light text-2xl ml-1">™</span>
                </h1>

                <p className="text-sm text-white/80 mb-2 font-medium">
                  Measure Psychological Exam Readiness, Not Academic Knowledge
                </p>
                <p className="text-xs text-white/50 mb-6 leading-relaxed max-w-md">
                  Reveals whether a student is mentally, emotionally, and strategically prepared to
                  perform at their best — regardless of how much they've studied. Powered by the LBI engine.
                </p>

                <div className="flex flex-col sm:flex-row gap-2 mb-6">
                  <Button
                    className="text-white font-semibold h-9 px-6 text-xs rounded-lg"
                    style={{ backgroundColor: BRAND.accent }}
                    onClick={() => onNavigate('exam-ready-checkout')}
                    data-testid="btn-start-assessment"
                  >
                    Start Assessment <ArrowRight size={14} className="ml-1.5" />
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/25 text-white hover:bg-white/10 h-9 px-6 text-xs font-semibold rounded-lg"
                    onClick={() => onNavigate('exam-ready-compare')}
                    data-testid="btn-compare-plans"
                  >
                    Compare Plans
                  </Button>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-white/55">
                  {[
                    { icon: CheckCircle, label: 'Non-Diagnostic' },
                    { icon: Shield, label: 'DPDP Compliant' },
                    { icon: Cpu, label: 'AI-Powered Reports' },
                    { icon: Lock, label: '256-bit Encrypted' },
                  ].map((item, i) => (
                    <span key={i} className="flex items-center gap-1.5">
                      <item.icon size={11} style={{ color: BRAND.accent }} /> {item.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: '6', label: 'Modules', sub: `${totalSubdomains} subdomains` },
                  { value: '100+', label: 'Questions', sub: 'age-adaptive' },
                  { value: '5', label: 'Report Types', sub: 'AI-powered' },
                  { value: 'Instant', label: 'Analysis', sub: 'real-time AI' },
                ].map((stat, idx) => (
                  <div key={idx} className="bg-white/[0.07] rounded-xl px-4 py-3.5 text-center" data-testid={`stat-card-${idx}`}>
                    <p className="text-2xl font-bold text-white tracking-tight">{stat.value}</p>
                    <p className="text-[11px] font-semibold text-white/75 mt-0.5">{stat.label}</p>
                    <p className="text-[10px] text-white/35">{stat.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-3 px-4 border-b border-gray-100" data-testid="exam-ready-value-strip">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100">
              {[
                { icon: Brain, label: 'Beyond Academics', text: 'Measures readiness, not knowledge' },
                { icon: Sparkles, label: 'AI-Powered', text: '5 report types with AI insights' },
                { icon: Activity, label: 'Behavioral Focus', text: 'Psychological exam preparedness' },
                { icon: Shield, label: 'Privacy First', text: 'DPDP compliant, encrypted' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 px-4 py-3" data-testid={`value-item-${i}`}>
                  <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.primary}08` }}>
                    <item.icon size={14} style={{ color: BRAND.primary }} />
                  </div>
                  <div>
                    <p className="text-xs font-bold" style={{ color: BRAND.primary }}>{item.label}</p>
                    <p className="text-[10px] text-gray-400 leading-snug">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 px-4" data-testid="exam-ready-dimensions">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: BRAND.accent }}>
                What We Measure
              </p>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }}>
                6 Dimensions of Exam Readiness
              </h2>
              <p className="text-xs text-gray-500 mt-1 max-w-lg mx-auto">
                Not how much your child has studied — but whether they're psychologically prepared to perform
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {READINESS_DIMENSIONS.map((dim, idx) => (
                <div key={idx} className="bg-white rounded-lg border border-gray-100 p-4 hover:shadow-sm transition-all group" data-testid={`dimension-card-${idx}`}>
                  <div className="flex items-start gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${dim.color}10` }}
                    >
                      <dim.icon size={18} style={{ color: dim.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-xs mb-1" style={{ color: BRAND.primary }}>{dim.title}</h3>
                      <p className="text-[10px] leading-relaxed text-gray-500">{dim.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 px-4" style={{ backgroundColor: '#f8fafc' }} data-testid="exam-ready-modules">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: BRAND.accent }}>
                  Comprehensive Framework
                </p>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }}>
                  6 Modules. {totalSubdomains} Subdomains.
                </h2>
                <p className="text-xs text-gray-500 mt-1 max-w-md">
                  Every behavioral factor that influences exam performance, measured with scientific precision.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
              {ASSESSMENT_MODULES.map((module) => {
                const isExpanded = expandedModule === module.id;
                return (
                  <div
                    key={module.id}
                    className="rounded-lg border transition-all cursor-pointer group"
                    style={{
                      borderColor: isExpanded ? module.color : '#f1f5f9',
                      backgroundColor: isExpanded ? `${module.color}04` : '#fff',
                    }}
                    onClick={() => setExpandedModule(isExpanded ? null : module.id)}
                    data-testid={`module-card-${module.id}`}
                  >
                    <div className="p-3">
                      <div className="flex items-start gap-2.5">
                        <div
                          className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${module.color}10` }}
                        >
                          <module.icon size={15} style={{ color: module.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ backgroundColor: `${module.color}12`, color: module.color }}>
                              {module.id}
                            </span>
                            <span className="text-[9px] text-gray-400">{module.subdomains} sub</span>
                          </div>
                          <h3 className="font-semibold text-[11px] leading-tight text-gray-900">{module.name}</h3>
                        </div>
                        <ChevronDown
                          size={12}
                          className="shrink-0 mt-0.5 text-gray-300"
                          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        />
                      </div>
                      {isExpanded && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <p className="text-[10px] leading-relaxed text-gray-500">{module.desc}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-center mt-5 text-[10px] text-gray-400">
              Powered by the LBI Engine. Scores are age-calibrated and norm-referenced.
            </p>
          </div>
        </section>

        <section className="py-12 px-4" data-testid="exam-ready-how-it-works">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: BRAND.accent }}>
                Assessment Process
              </p>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }}>
                How It Works
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                From consent to actionable readiness insights in four steps
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {HOW_IT_WORKS.map((step) => (
                <div key={step.step} className="relative text-center" data-testid={`step-${step.step}`}>
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm mx-auto mb-3"
                    style={{ backgroundColor: BRAND.primary }}
                  >
                    {step.step}
                  </div>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: `${BRAND.accent}10` }}>
                    <step.icon size={18} style={{ color: BRAND.accent }} />
                  </div>
                  <h3 className="font-bold text-xs mb-1" style={{ color: BRAND.primary }}>{step.title}</h3>
                  <p className="text-[11px] text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 px-4" style={{ backgroundColor: '#f8fafc' }} data-testid="exam-ready-report-section">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: BRAND.accent }}>
                  Sample Report
                </p>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }}>
                  What Your Report Reveals
                </h2>
                <p className="text-xs text-gray-500 mt-1 max-w-md">
                  Deep, actionable intelligence into your child's exam readiness
                </p>
              </div>
              <Button
                variant="outline"
                className="font-semibold px-4 rounded-lg shrink-0 h-8 text-xs"
                style={{ borderColor: BRAND.primary, color: BRAND.primary }}
                onClick={() => onNavigate('request-demo')}
                data-testid="btn-view-sample"
              >
                <Play size={12} className="mr-1.5" /> Request Sample
              </Button>
            </div>

            <div className="grid lg:grid-cols-5 gap-4">
              <div className="lg:col-span-3">
                <div className="bg-white rounded-xl border border-gray-100 p-5 h-full">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="h-8 w-8 rounded-md flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}08` }}>
                      <BarChart3 size={15} style={{ color: BRAND.primary }} />
                    </div>
                    <div>
                      <h3 className="font-bold text-xs" style={{ color: BRAND.primary }}>Module-Level Scorecard</h3>
                      <p className="text-[10px] text-gray-400">Percentile scores across readiness modules</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {[
                      { domain: 'M01 · Stress Management', score: 58, color: BRAND.orange },
                      { domain: 'M02 · Focus & Attention', score: 72, color: '#0B3C5D' },
                      { domain: 'M03 · Confidence & Self-Belief', score: 45, color: BRAND.red },
                      { domain: 'M04 · Emotional Regulation', score: 67, color: '#4ECDC4' },
                      { domain: 'M05 · Study Strategy & Habits', score: 83, color: BRAND.green },
                      { domain: 'M06 · Social & Environmental', score: 61, color: BRAND.accent },
                    ].map((item, idx) => (
                      <div key={idx} data-testid={`report-score-row-${idx}`}>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="font-medium text-gray-600">{item.domain}</span>
                          <span className="font-bold text-xs tabular-nums" style={{ color: item.color }}>
                            {item.score}<span className="text-[10px] font-normal text-gray-300">/100</span>
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100">
                          <div className="h-full rounded-full" style={{ width: `${item.score}%`, backgroundColor: item.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] mt-4 pt-3 italic text-gray-400 border-t border-gray-100">
                    Sample data. Actual reports include all 6 modules with subdomain breakdowns.
                  </p>
                </div>
              </div>

              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl border border-gray-100 p-5 h-full">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="h-8 w-8 rounded-md flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}10` }}>
                      <Lightbulb size={15} style={{ color: BRAND.accent }} />
                    </div>
                    <div>
                      <h3 className="font-bold text-xs" style={{ color: BRAND.primary }}>Key Insights</h3>
                      <p className="text-[10px] text-gray-400">AI-generated analysis</p>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    {[
                      { label: 'Root Cause', text: 'Low confidence (M03) is amplifying stress reactivity (M01), creating a cycle of exam anxiety.', type: 'alert' },
                      { label: 'Strength', text: 'Strong study habits (M05) with consistent revision patterns — knowledge foundation is solid.', type: 'success' },
                      { label: 'Action Plan', text: 'Confidence-building exercises with mock exam desensitization. 21-day improvement window.', type: 'action' },
                      { label: 'Key Finding', text: 'Student knows material but underperforms due to psychological barriers, not academic gaps.', type: 'warning' },
                    ].map((insight, idx) => {
                      const colors = {
                        alert: { bg: '#fef2f2', border: BRAND.red, text: BRAND.red },
                        success: { bg: '#f0fdf4', border: BRAND.green, text: BRAND.green },
                        warning: { bg: '#fffbeb', border: BRAND.orange, text: BRAND.orange },
                        action: { bg: 'rgba(11,60,93,0.06)', border: BRAND.primary, text: BRAND.primary },
                      };
                      const c = colors[insight.type as keyof typeof colors];
                      return (
                        <div key={idx} className="p-3 rounded-lg border-l-[3px]" style={{ backgroundColor: c.bg, borderLeftColor: c.border }} data-testid={`insight-card-${idx}`}>
                          <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: c.text }}>{insight.label}</p>
                          <p className="text-[11px] leading-relaxed text-gray-600">{insight.text}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-12 px-4" data-testid="exam-ready-ai-reports">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: BRAND.accent }}>
                AI-Powered Intelligence
              </p>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }}>
                5 Report Types. AI-Powered.
              </h2>
              <p className="text-xs text-gray-500 mt-1 max-w-lg mx-auto">
                Go beyond basic scores with AI-driven analysis that reveals why your child performs the way they do
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {REPORT_TYPES.map((report, idx) => (
                <div key={idx} className="bg-white rounded-xl overflow-hidden border border-gray-100 hover:shadow-sm transition-all group" data-testid={`report-type-${idx}`}>
                  {report.ai && <div className="h-0.5" style={{ backgroundColor: BRAND.accent }} />}
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: report.ai ? `${BRAND.accent}10` : `${BRAND.primary}08` }}
                      >
                        <report.icon size={17} style={{ color: report.ai ? BRAND.accent : BRAND.primary }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-xs" style={{ color: BRAND.primary }}>{report.name}</h3>
                          {report.ai && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }}>
                              <Sparkles size={8} /> AI
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] leading-relaxed text-gray-500 mb-2">{report.desc}</p>
                        <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{
                          backgroundColor: report.ai ? `${BRAND.orange}10` : `${BRAND.green}10`,
                          color: report.ai ? BRAND.orange : BRAND.green,
                        }}>
                          {report.tier}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div
                className="rounded-xl border-2 border-dashed p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-sm transition-all"
                style={{ borderColor: `${BRAND.accent}40`, backgroundColor: `${BRAND.accent}04` }}
                onClick={() => onNavigate('exam-ready-compare')}
                data-testid="btn-upgrade-ai-reports"
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-2" style={{ backgroundColor: `${BRAND.accent}10` }}>
                  <Zap size={20} style={{ color: BRAND.accent }} />
                </div>
                <p className="font-bold text-xs mb-1" style={{ color: BRAND.primary }}>Unlock AI Reports</p>
                <p className="text-[10px] text-gray-500 mb-2 leading-snug">Available on Starter plan and above</p>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold" style={{ color: BRAND.accent }}>
                  Upgrade <ArrowRight size={10} />
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="py-12 px-4" style={{ backgroundColor: '#f8fafc' }} data-testid="exam-ready-instructions">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: BRAND.accent }}>
                Before You Begin
              </p>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }}>
                Assessment Guidelines
              </h2>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-md flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}10` }}>
                    <ClipboardList size={15} style={{ color: BRAND.accent }} />
                  </div>
                  <h3 className="font-bold text-sm" style={{ color: BRAND.primary }}>Instructions</h3>
                </div>
                <div className="space-y-2.5">
                  {[
                    { step: 1, title: 'Quiet Environment', desc: 'Calm, distraction-free space with good lighting' },
                    { step: 2, title: 'Uninterrupted Time', desc: '30-40 minutes without breaks. Cannot be paused midway.' },
                    { step: 3, title: 'Honest Responses', desc: 'No right or wrong answers. Answer naturally.' },
                    { step: 4, title: 'Stable Internet', desc: 'Tablet or computer with stable connection.' },
                  ].map((item) => (
                    <div key={item.step} className="flex items-start gap-3 p-2.5 rounded-lg" style={{ backgroundColor: '#f8fafc' }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-white" style={{ backgroundColor: BRAND.primary }}>
                        {item.step}
                      </div>
                      <div>
                        <h4 className="font-bold text-[11px]" style={{ color: BRAND.primary }}>{item.title}</h4>
                        <p className="text-[10px] text-gray-500">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-md flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}08` }}>
                    <UserCheck size={15} style={{ color: BRAND.primary }} />
                  </div>
                  <h3 className="font-bold text-sm" style={{ color: BRAND.primary }}>Eligibility & Requirements</h3>
                </div>
                <div className="space-y-2.5">
                  {[
                    { title: 'Age Group', desc: 'Children aged 10-18 years are eligible' },
                    { title: 'Parental Consent', desc: 'Mandatory for all minors (DPDP Act)' },
                    { title: 'Language', desc: 'Available in English. Basic reading comprehension required.' },
                    { title: 'Device', desc: 'Modern browser on tablet, laptop, or desktop' },
                  ].map((item, idx) => (
                    <div key={idx} className="p-3 rounded-lg border" style={{ borderColor: `${BRAND.accent}30`, backgroundColor: `${BRAND.accent}05` }}>
                      <div className="flex items-start gap-2.5">
                        <CheckCircle size={13} style={{ color: BRAND.accent }} className="mt-0.5 shrink-0" />
                        <div>
                          <h4 className="font-bold text-[11px]" style={{ color: BRAND.primary }}>{item.title}</h4>
                          <p className="text-[10px] text-gray-500">{item.desc}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-12 px-4" data-testid="exam-ready-differentiators">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: BRAND.accent }}>
                Why ExamReadiness Index™
              </p>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }}>
                Not Just Another Mock Test
              </h2>
              <p className="text-xs text-gray-500 mt-1 max-w-lg mx-auto">
                Fundamentally different from academic mock tests, revision quizzes, or practice papers
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: Brain, title: 'Psychological, Not Academic', desc: 'Measures readiness to perform, not subject knowledge.' },
                { icon: Sparkles, title: 'AI-Powered Insights', desc: 'Cross-module AI identifies hidden performance barriers.' },
                { icon: Shield, title: 'Privacy-First', desc: 'DPDP compliant. Encrypted. Non-diagnostic.' },
                { icon: TrendingUp, title: 'Track Improvement', desc: 'Longitudinal tracking across exam cycles.' },
                { icon: Target, title: 'Exam-Specific', desc: 'Designed for high-stakes exam readiness assessment.' },
                { icon: RefreshCw, title: 'Adaptive Engine', desc: 'Questions adapt to age and response patterns.' },
                { icon: Award, title: 'LBI-Powered', desc: 'Built on the proven Learning Behavior Index framework.' },
                { icon: Compass, title: 'Action Plans', desc: '21-day improvement roadmaps with daily micro-goals.' },
              ].map((feature, idx) => (
                <div key={idx} className="bg-white rounded-lg border border-gray-100 p-4 hover:shadow-sm transition-all group" data-testid={`feature-card-${idx}`}>
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center mb-3"
                    style={{ backgroundColor: `${BRAND.primary}08` }}
                  >
                    <feature.icon size={16} style={{ color: BRAND.primary }} />
                  </div>
                  <h3 className="font-bold text-[11px] mb-1 text-gray-900">{feature.title}</h3>
                  <p className="text-[10px] leading-relaxed text-gray-500">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 px-4" style={{ backgroundColor: '#f8fafc' }} data-testid="exam-ready-consent">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: BRAND.accent }}>
                Trust & Compliance
              </p>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }}>
                Your Privacy Matters
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {[
                {
                  icon: Eye,
                  title: 'Parental Consent',
                  color: BRAND.primary,
                  items: [
                    'You consent to your child taking this behavioral assessment',
                    'This is NOT a clinical or diagnostic test',
                    'Data deletion available at any time (DPDP Act)',
                  ]
                },
                {
                  icon: Shield,
                  title: 'Data Protection',
                  color: BRAND.accent,
                  items: [
                    '256-bit SSL encryption for all data',
                    'DPDP Act 2023 compliant',
                    'Never shared with third parties',
                  ]
                },
                {
                  icon: AlertTriangle,
                  title: 'Important Notice',
                  color: BRAND.orange,
                  items: [
                    'Not a diagnostic or clinical tool',
                    'Results are indicative guidance only',
                    'Consult professionals for mental health concerns',
                  ]
                },
              ].map((section, idx) => (
                <div key={idx} className="bg-white rounded-xl overflow-hidden border border-gray-100" data-testid={`trust-card-${idx}`}>
                  <div className="h-1" style={{ backgroundColor: section.color }} />
                  <div className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${section.color}10` }}
                      >
                        <section.icon size={18} style={{ color: section.color }} />
                      </div>
                      <h3 className="font-bold text-sm" style={{ color: section.color }}>{section.title}</h3>
                    </div>
                    <ul className="space-y-2">
                      {section.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle size={12} className="shrink-0 mt-0.5" style={{ color: section.color }} />
                          <span className="text-[11px] text-gray-600 leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 px-4" data-testid="exam-ready-faq">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-6">
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: BRAND.accent }}>FAQ</p>
              <h2 className="text-lg md:text-xl font-bold tracking-tight" style={{ color: BRAND.primary }}>
                Frequently Asked Questions
              </h2>
            </div>
            <div className="space-y-2">
              {FAQS.map((faq, idx) => {
                const isOpen = expandedFaq === idx;
                return (
                  <div
                    key={idx}
                    className="bg-white rounded-lg border cursor-pointer transition-all hover:shadow-sm"
                    style={{ borderColor: isOpen ? BRAND.primary : '#f1f5f9' }}
                    onClick={() => setExpandedFaq(isOpen ? null : idx)}
                    data-testid={`faq-item-${idx}`}
                  >
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <h3 className="text-xs font-semibold" style={{ color: isOpen ? BRAND.primary : '#1e293b' }}>{faq.question}</h3>
                      <div className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: isOpen ? `${BRAND.primary}10` : '#f8fafc' }}>
                        {isOpen ? (
                          <Minus size={10} style={{ color: BRAND.primary }} />
                        ) : (
                          <Plus size={10} className="text-gray-400" />
                        )}
                      </div>
                    </div>
                    {isOpen && (
                      <div className="px-4 pb-3">
                        <p className="text-[11px] text-gray-500 leading-relaxed border-t border-gray-100 pt-2.5">{faq.answer}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="py-14 px-4" style={{ backgroundColor: BRAND.primary }} data-testid="exam-ready-cta">
          <div className="max-w-2xl mx-auto text-center">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-5">
              <Target size={24} className="text-white" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 tracking-tight leading-tight">
              Is Your Child Ready to
              <br />
              <span style={{ color: BRAND.accent }}>Perform at Their Best?</span>
            </h2>
            <p className="text-white/55 mb-6 text-xs max-w-md mx-auto leading-relaxed">
              Go beyond academic preparation. Understand the psychological factors that determine exam performance.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 mb-6">
              <Button
                className="h-9 px-8 font-semibold text-xs rounded-lg"
                style={{ backgroundColor: BRAND.accent, color: '#fff' }}
                onClick={() => onNavigate('exam-ready-checkout')}
                data-testid="btn-cta-start"
              >
                Start Assessment <ArrowRight size={14} className="ml-1.5" />
              </Button>
              <Button
                variant="outline"
                className="h-9 px-8 font-semibold text-xs border-white/25 text-white hover:bg-white/10 rounded-lg"
                onClick={() => onNavigate('exam-ready-compare')}
                data-testid="btn-cta-compare"
              >
                Compare Plans
              </Button>
            </div>
            <div className="flex flex-wrap justify-center gap-5 text-white/40 text-[11px]">
              <span className="flex items-center gap-1.5"><Clock size={11} /> 30-40 minutes</span>
              <span className="flex items-center gap-1.5"><Shield size={11} /> Non-diagnostic</span>
              <span className="flex items-center gap-1.5"><Sparkles size={11} /> AI-Powered Reports</span>
            </div>
          </div>
        </section>

      </main>

      <Footer onNavigate={onNavigate} />
      <BotWidget mode="pre-purchase" />
    </div>
  );
}
