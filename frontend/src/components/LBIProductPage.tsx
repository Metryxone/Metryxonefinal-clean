import { Button } from "@/components/ui/button";
import { 
  Brain, CheckCircle2, Users, Clock, Shield, ArrowRight, ChevronDown,
  BarChart3, Lightbulb, Target, Heart, Smile, BookOpen, MessageCircle,
  Flame, Activity, Compass, HelpCircle, Star, Zap, Eye, UserCheck,
  AlertTriangle, Play, Globe, Award, Layers, Lock
} from "lucide-react";
import { useState } from "react";

const BRAND = {
  primary: '#0B3C5D',
  accent: '#4ECDC4',
};

const DOMAINS = [
  { id: 'D01', name: 'Academic & Cognitive Effectiveness', subdomains: 6, icon: BookOpen, description: 'Measures how effectively a student processes, retains, and applies academic content' },
  { id: 'D02', name: 'Thinking Quality Under Pressure', subdomains: 5, icon: Brain, description: 'Evaluates cognitive performance during high-stakes or timed situations' },
  { id: 'D03', name: 'Examination Stress & Emotional Regulation', subdomains: 6, icon: Heart, description: 'Assesses emotional responses to academic pressure and exam anxiety' },
  { id: 'D04', name: 'Confidence & Self-Concept', subdomains: 5, icon: Star, description: 'Measures self-belief, academic identity, and confidence in abilities' },
  { id: 'D05', name: 'Adjustment & Coping', subdomains: 5, icon: Shield, description: 'Evaluates resilience, adaptability, and coping mechanisms' },
  { id: 'D06', name: 'Social & Emotional Intelligence', subdomains: 6, icon: Smile, description: 'Assesses interpersonal skills, empathy, and emotional awareness' },
  { id: 'D07', name: 'Discipline & Habits', subdomains: 5, icon: Target, description: 'Measures consistency in study habits, time management, and routine' },
  { id: 'D08', name: 'Communication', subdomains: 4, icon: MessageCircle, description: 'Evaluates verbal, written, and non-verbal communication abilities' },
  { id: 'D09', name: 'Motivation & Values', subdomains: 5, icon: Flame, description: 'Assesses intrinsic/extrinsic motivation and value alignment' },
  { id: 'D10', name: 'Lifestyle & Pressure Environment', subdomains: 5, icon: Activity, description: 'Evaluates external pressures including family, peer, and societal factors' },
  { id: 'D11', name: 'Competitive Exam Readiness', subdomains: 6, icon: Zap, description: 'Measures preparedness for competitive and high-stakes examinations' },
  { id: 'D12', name: 'Root Cause Mapping', subdomains: 5, icon: Compass, description: 'Identifies underlying factors affecting academic performance' },
  { id: 'D13', name: 'Academic Planning & Recovery', subdomains: 5, icon: BarChart3, description: 'Assesses ability to plan, organize, and recover from setbacks' },
  { id: 'D14', name: 'Metacognition', subdomains: 5, icon: Lightbulb, description: 'Measures awareness and control of own learning processes' },
  { id: 'D15', name: 'Help-Seeking', subdomains: 5, icon: HelpCircle, description: 'Evaluates willingness and ability to seek appropriate support' },
  { id: 'D16', name: 'Academic Identity', subdomains: 5, icon: Eye, description: 'Measures how students perceive themselves as learners' },
  { id: 'D17', name: 'Transition Adaptability', subdomains: 5, icon: ArrowRight, description: 'Assesses readiness for academic and life transitions' },
  { id: 'D18', name: 'Teacher-Student Interaction', subdomains: 5, icon: UserCheck, description: 'Evaluates quality of educational relationships and engagement' },
  { id: 'D19', name: 'Over-Compliance Risk', subdomains: 4, icon: AlertTriangle, description: 'Identifies patterns of excessive compliance that may mask issues' },
];

interface LBIProductPageProps {
  role?: 'parent' | 'institute';
  onStartAssessment?: () => void;
}

export function LBIProductPage({ role = 'parent', onStartAssessment }: LBIProductPageProps) {
  const [showAllDomains, setShowAllDomains] = useState(false);
  const [hoveredDomain, setHoveredDomain] = useState<string | null>(null);
  const totalSubdomains = DOMAINS.reduce((sum, d) => sum + d.subdomains, 0);
  const visibleDomains = showAllDomains ? DOMAINS : DOMAINS.slice(0, 8);

  return (
    <div className="max-w-5xl mx-auto" data-testid="lbi-product-page">

      <div className="text-center pt-6 pb-8 px-4" data-testid="lbi-hero">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 bg-white mb-5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: BRAND.accent }} />
          <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Core Assessment Product</span>
        </div>

        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3" style={{ color: BRAND.primary }} data-testid="text-lbi-title">
          Learning Behavior Index<span className="text-gray-300 font-light">™</span>
        </h1>

        <p className="text-base text-gray-500 max-w-2xl mx-auto leading-relaxed mb-6">
          Go beyond grades. LBI maps <strong className="text-gray-700">19 behavioral domains</strong> and{' '}
          <strong className="text-gray-700">{totalSubdomains} subdomains</strong> to reveal why students 
          perform the way they do — not just how well.
        </p>

        <div className="flex items-center justify-center gap-3 mb-8">
          <Button 
            className="text-white font-semibold h-11 px-7 text-sm rounded-full shadow-md hover:shadow-lg transition-shadow"
            style={{ backgroundColor: BRAND.primary }}
            onClick={onStartAssessment}
            data-testid="button-start-lbi-hero"
          >
            <Play size={15} className="mr-2" />
            Begin Assessment
          </Button>
          <Button 
            variant="outline"
            className="h-11 px-7 text-sm font-medium rounded-full border-gray-200 text-gray-600"
            data-testid="button-learn-more"
          >
            View Sample Report
          </Button>
        </div>

        <div className="flex items-center justify-center gap-6 text-xs text-gray-400">
          {[
            { icon: Clock, text: '30-45 min' },
            { icon: Users, text: '50K+ students' },
            { icon: Globe, text: '10+ languages' },
            { icon: Lock, text: 'DPDP compliant' },
          ].map((item, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <item.icon size={13} />
              {item.text}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 rounded-2xl overflow-hidden border border-gray-100 mb-10" style={{ backgroundColor: BRAND.primary }} data-testid="lbi-stats-bar">
        {[
          { value: '19', label: 'Domains' },
          { value: String(totalSubdomains), label: 'Subdomains' },
          { value: '3', label: 'Age Bands' },
          { value: '10+', label: 'Languages' },
        ].map((stat, i) => (
          <div key={i} className={`py-5 text-center ${i < 3 ? 'border-r border-white/10' : ''}`} data-testid={`stat-${i}`}>
            <p className="text-2xl md:text-3xl font-bold text-white">{stat.value}</p>
            <p className="text-[11px] text-white/50 font-medium mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-10 px-1">
        <div className="space-y-4" data-testid="lbi-what-section">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: BRAND.accent }}>
              What It Measures
            </p>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Beyond test scores</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              LBI identifies the behavioral patterns, emotional responses, cognitive strategies, and 
              environmental factors that shape how a student learns, adapts, and performs. It answers 
              the "why" behind academic outcomes.
            </p>
          </div>

          <div className="space-y-2.5">
            {[
              { icon: Brain, text: 'Measures behaviors, not knowledge — reveals hidden patterns' },
              { icon: Lightbulb, text: 'Generates specific, personalized recommendations per domain' },
              { icon: Layers, text: 'Questions adapt to developmental stage across 3 age bands' },
              { icon: BarChart3, text: 'Longitudinal tracking shows growth across assessment cycles' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: `${BRAND.primary}08` }}>
                  <item.icon size={14} style={{ color: BRAND.primary }} />
                </div>
                <p className="text-sm text-gray-600 leading-snug pt-0.5">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3" data-testid="lbi-age-bands">
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: BRAND.accent }}>
            Age Bands
          </p>
          {[
            { code: 'A', range: '6–10 yrs', grades: 'Class 1–5', label: 'Primary', desc: 'Foundation stage with age-appropriate behavioral indicators and early social-emotional development', color: BRAND.accent },
            { code: 'B', range: '11–14 yrs', grades: 'Class 6–9', label: 'Middle School', desc: 'Transition stage with emerging exam stress patterns, peer comparison, and academic identity', color: BRAND.primary },
            { code: 'C', range: '15–18 yrs', grades: 'Class 10–12', label: 'Senior', desc: 'Advanced stage with competitive exam readiness, career alignment, and metacognitive maturity', color: '#0B3C5D' },
          ].map((band) => (
            <div 
              key={band.code} 
              className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 bg-white hover:border-gray-200 transition-colors"
              data-testid={`age-band-${band.code}`}
            >
              <div 
                className="w-11 h-11 rounded-xl flex items-center justify-center text-base font-bold text-white shrink-0"
                style={{ backgroundColor: band.color }}
              >
                {band.code}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-sm font-bold text-gray-900">{band.label}</span>
                  <span className="text-[11px] text-gray-400">{band.range} · {band.grades}</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{band.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-10 px-1" data-testid="lbi-domains-section">
        <div className="flex items-end justify-between mb-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: BRAND.accent }}>
              Assessment Framework
            </p>
            <h2 className="text-xl font-bold text-gray-900">19 Domains · {totalSubdomains} Subdomains</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {visibleDomains.map((domain) => {
            const Icon = domain.icon;
            const isHovered = hoveredDomain === domain.id;
            return (
              <div
                key={domain.id}
                className="relative p-3.5 rounded-xl border border-gray-100 bg-white cursor-default transition-all hover:border-gray-200 hover:shadow-sm"
                onMouseEnter={() => setHoveredDomain(domain.id)}
                onMouseLeave={() => setHoveredDomain(null)}
                data-testid={`domain-${domain.id}`}
              >
                <div className="flex items-start gap-2.5">
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${BRAND.primary}08` }}
                  >
                    <Icon size={15} style={{ color: BRAND.primary }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-gray-800 leading-tight">{domain.name}</p>
                    <span className="text-[10px] text-gray-400 mt-0.5 inline-block">
                      {domain.id} · {domain.subdomains} sub
                    </span>
                  </div>
                </div>
                {isHovered && (
                  <p className="text-[10px] text-gray-500 leading-relaxed mt-2 pt-2 border-t border-gray-50">
                    {domain.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {!showAllDomains && (
          <div className="text-center mt-4">
            <button 
              onClick={() => setShowAllDomains(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-5 py-2 rounded-full border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800 transition-colors"
              data-testid="button-show-all-domains"
            >
              Show all 19 domains
              <ChevronDown size={14} />
            </button>
          </div>
        )}

        {showAllDomains && (
          <div className="text-center mt-4">
            <button 
              onClick={() => setShowAllDomains(false)}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              data-testid="button-show-less-domains"
            >
              Show less
            </button>
          </div>
        )}
      </div>

      <div className="mb-10 px-1" data-testid="lbi-process-section">
        <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: BRAND.accent }}>
          How It Works
        </p>
        <h2 className="text-xl font-bold text-gray-900 mb-6">Four simple steps</h2>

        <div className="relative">
          <div className="hidden md:block absolute top-6 left-[12.5%] right-[12.5%] h-px bg-gray-100" />
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { step: 1, title: 'Register', desc: 'Parent gives consent, student profile is created with the right age band', icon: Users },
              { step: 2, title: 'Assess', desc: 'Adaptive questions across 19 domains, calibrated by age. Takes 30-45 min', icon: BookOpen },
              { step: 3, title: 'Analyze', desc: 'AI engine scores responses, maps cross-domain correlations and root causes', icon: Brain },
              { step: 4, title: 'Act', desc: 'Receive detailed report with domain scores, trends, and personalized action plans', icon: Award },
            ].map((item) => (
              <div key={item.step} className="text-center relative" data-testid={`step-${item.step}`}>
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 relative z-10 bg-white border-2" style={{ borderColor: BRAND.primary }}>
                  <item.icon size={18} style={{ color: BRAND.primary }} />
                </div>
                <p className="text-sm font-bold text-gray-900 mb-1">{item.title}</p>
                <p className="text-[11px] text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-10 px-1" data-testid="lbi-trust-section">
        <div className="rounded-2xl border border-gray-100 overflow-hidden">
          <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
            {[
              {
                title: 'For Parents',
                icon: Users,
                color: BRAND.primary,
                items: [
                  'Understand the "why" behind performance',
                  'Personalized action plans per child',
                  'Track behavioral growth over time',
                ],
              },
              {
                title: 'For Schools',
                icon: BookOpen,
                color: BRAND.accent,
                items: [
                  'Cohort-level behavioral dashboards',
                  'Identify at-risk students early',
                  'NEP 2020 and DPDP compliant',
                ],
              },
              {
                title: 'For Students',
                icon: Star,
                color: '#0B3C5D',
                items: [
                  'Know your own learning style',
                  'Build self-awareness & metacognition',
                  'Targeted exam anxiety strategies',
                ],
              },
            ].map((group) => (
              <div key={group.title} className="p-6" data-testid={`benefit-${group.title.toLowerCase().replace(/\s/g, '-')}`}>
                <div className="flex items-center gap-2.5 mb-4">
                  <group.icon size={18} style={{ color: group.color }} />
                  <h3 className="text-sm font-bold text-gray-900">{group.title}</h3>
                </div>
                <ul className="space-y-2.5">
                  {group.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                      <CheckCircle2 size={14} className="shrink-0 mt-px" style={{ color: group.color }} />
                      <span className="leading-snug">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl p-8 md:p-10 text-center mb-6" style={{ backgroundColor: BRAND.primary }} data-testid="lbi-cta">
        <Brain size={28} className="mx-auto mb-3 text-white/70" />
        <h3 className="text-xl font-bold text-white mb-2">Ready to understand how your child learns?</h3>
        <p className="text-sm text-white/50 mb-6 max-w-md mx-auto">
          Start the assessment and get a comprehensive behavioral intelligence report across all 19 domains.
        </p>
        <Button 
          className="text-white font-semibold h-11 px-8 text-sm rounded-full shadow-md"
          style={{ backgroundColor: BRAND.accent }}
          onClick={onStartAssessment}
          data-testid="button-start-lbi"
        >
          <Brain size={16} className="mr-2" />
          Start LBI Assessment
          <ArrowRight size={15} className="ml-2" />
        </Button>
        <div className="flex items-center justify-center gap-4 mt-5 text-[11px] text-white/35">
          <span className="flex items-center gap-1"><Shield size={12} /> DPDP Compliant</span>
          <span className="flex items-center gap-1"><Lock size={12} /> SOC2 Certified</span>
          <span className="flex items-center gap-1"><Clock size={12} /> 30-45 min</span>
        </div>
      </div>

    </div>
  );
}
