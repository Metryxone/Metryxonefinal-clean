import { useState } from 'react';
import { Brain, CheckCircle, ChevronDown, ChevronUp, Clock, Shield, ArrowRight, Target, BookOpen, Users, FileText, Award, Lightbulb, Zap, BarChart3, Lock, GraduationCap, TrendingUp, Sparkles } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Screen } from "../App";

interface Props {
  onNavigate: (screen: Screen) => void;
}

const BRAND = {
  primary: '#344E86',
  accent: '#4ECDC4',
  green: '#22c55e',
  purple: '#8b5cf6',
};

const ASSESSMENT_DOMAINS = [
  { 
    icon: Brain, 
    title: 'Academic & Cognitive Effectiveness', 
    code: 'ACE',
    desc: 'Learning efficiency, comprehension speed, and knowledge retention patterns', 
    color: BRAND.primary 
  },
  { 
    icon: Target, 
    title: 'Test-Taking & Question Processing', 
    code: 'TQP',
    desc: 'How your child approaches and processes exam questions under time pressure', 
    color: BRAND.accent 
  },
];

const FAQS = [
  {
    question: 'What is Mini Learning Check?',
    answer: 'Mini Learning Check is a focused 15-20 minute assessment that evaluates your child\'s core learning effectiveness across Academic & Cognitive Effectiveness (ACE) and Test-Taking & Question Processing (TQP) domains.',
  },
  {
    question: 'Who is this assessment for?',
    answer: 'This assessment is designed for students of any class (K-12) who want a quick snapshot of their learning patterns without a full comprehensive assessment.',
  },
  {
    question: 'How is this different from EXAM READY™?',
    answer: 'Mini Learning Check focuses on 2 core domains (ACE & TQP) while EXAM READY™ covers 11 domains for comprehensive exam readiness. This is ideal for quick check-ins between major assessments.',
  },
  {
    question: 'What do I get in the report?',
    answer: 'You receive a focused report with scores for both domains, key insights about learning patterns, and 3-5 actionable recommendations for improvement.',
  },
];

export function MiniCheckPage({ onNavigate }: Props) {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Navbar onNavigate={onNavigate} currentScreen="mini-check" />

      <main className="flex-1 pt-20">
        <section className="py-12 md:py-16 px-4" style={{ backgroundColor: BRAND.primary }}>
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div className="text-white">
                <div className="flex items-center gap-2 mb-4">
                  <Badge className="bg-white/20 text-white border-0 text-sm px-3 py-1.5 font-medium">
                    <Clock size={14} className="mr-1.5" /> 15-20 minutes
                  </Badge>
                  <Badge className="bg-white/20 text-white border-0 text-sm px-3 py-1.5 font-medium">
                    Any Class
                  </Badge>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight tracking-tight">
                  Mini Learning Check
                </h1>
                <p className="text-2xl font-semibold mb-2" style={{ color: BRAND.accent }}>
                  Quick Snapshot of Learning Effectiveness
                </p>
                <p className="text-white/90 text-lg mb-5 leading-relaxed">
                  A focused assessment covering Academic & Cognitive Effectiveness (ACE) and Test-Taking patterns. Perfect for understanding core learning behaviors in just 15-20 minutes.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 mb-5">
                  <Button 
                    size="lg"
                    className="text-white font-semibold h-12 px-6 text-base"
                    style={{ backgroundColor: BRAND.accent }}
                    onClick={() => onNavigate('exam-ready-checkout')}
                    data-testid="btn-start-mini-check"
                  >
                    Start Assessment - ₹299 <ArrowRight size={18} className="ml-2" />
                  </Button>
                  <Button 
                    size="lg"
                    variant="outline"
                    className="border-white/40 text-white hover:bg-white/10 h-12 px-6 text-base font-semibold"
                    onClick={() => onNavigate('exam-ready')}
                  >
                    View All Packages
                  </Button>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-white/80 font-medium">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle size={16} style={{ color: BRAND.accent }} /> 2 Core Domains
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Shield size={16} style={{ color: BRAND.accent }} /> DPDP Compliant
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Zap size={16} style={{ color: BRAND.accent }} /> Instant Results
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Brain, value: '2', label: 'Core Domains' },
                  { icon: FileText, value: '25+', label: 'Questions' },
                  { icon: Clock, value: '15-20', label: 'Minutes' },
                  { icon: BarChart3, value: 'Focused', label: 'Report' },
                ].map((stat, idx) => (
                  <Card key={idx} className="bg-white/10 border-0 backdrop-blur-sm">
                    <CardContent className="p-5 text-center text-white">
                      <stat.icon size={28} className="mx-auto mb-2" style={{ color: BRAND.accent }} />
                      <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
                      <p className="text-sm text-white/70 font-medium">{stat.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-12 px-4" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <Badge className="mb-2 font-semibold" style={{ backgroundColor: `${BRAND.accent}20`, color: BRAND.accent }}>
                Focused Analysis
              </Badge>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ color: BRAND.primary }}>
                What We Assess
              </h2>
              <p className="mt-2 max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
                Two core domains that form the foundation of effective learning
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {ASSESSMENT_DOMAINS.map((domain, idx) => (
                <Card key={idx} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div 
                        className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${domain.color}15` }}
                      >
                        <domain.icon size={28} style={{ color: domain.color }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg" style={{ color: BRAND.primary }}>{domain.title}</h3>
                          <Badge variant="outline" className="text-[10px]" style={{ borderColor: domain.color, color: domain.color }}>
                            {domain.code}
                          </Badge>
                        </div>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{domain.desc}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold" style={{ color: BRAND.primary }}>Who Should Take This?</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { icon: GraduationCap, title: 'Quick Check-In', desc: 'Students wanting a snapshot between major exams' },
                { icon: TrendingUp, title: 'Progress Tracking', desc: 'Parents monitoring learning improvement over time' },
                { icon: Lightbulb, title: 'First-Time Users', desc: 'Families new to behavioral assessments' },
              ].map((item, idx) => (
                <Card key={idx} className="border shadow-sm text-center">
                  <CardContent className="p-5">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                      style={{ backgroundColor: `${BRAND.primary}10` }}
                    >
                      <item.icon size={24} style={{ color: BRAND.primary }} />
                    </div>
                    <h3 className="font-semibold mb-1" style={{ color: BRAND.primary }}>{item.title}</h3>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{item.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 px-4" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold" style={{ color: BRAND.primary }}>Frequently Asked Questions</h2>
            </div>
            <div className="space-y-3">
              {FAQS.map((faq, idx) => (
                <Card 
                  key={idx} 
                  className="border-0 shadow-sm cursor-pointer"
                  onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold" style={{ color: BRAND.primary }}>{faq.question}</h3>
                      {expandedFaq === idx ? (
                        <ChevronUp size={20} style={{ color: BRAND.accent }} />
                      ) : (
                        <ChevronDown size={20} style={{ color: 'var(--text-secondary)' }} />
                      )}
                    </div>
                    {expandedFaq === idx && (
                      <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{faq.answer}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 px-4" style={{ backgroundColor: BRAND.accent }}>
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Ready to Understand Your Child's Learning Patterns?
            </h2>
            <p className="text-white/80 mb-6 text-lg">
              Get focused insights in just 15-20 minutes
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button 
                size="lg"
                className="h-12 px-8 font-semibold"
                style={{ backgroundColor: BRAND.primary }}
                onClick={() => onNavigate('exam-ready-checkout')}
              >
                Start Mini Learning Check - ₹299
                <ArrowRight size={18} className="ml-2" />
              </Button>
              <Button 
                size="lg"
                variant="outline"
                className="h-12 px-8 font-semibold border-white text-white hover:bg-white/10"
                onClick={() => onNavigate('exam-ready')}
              >
                Compare All Packages
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
