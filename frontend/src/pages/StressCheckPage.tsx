import { BRAND } from '@/design-system/tokens';
import { useState } from 'react';
import { Brain, CheckCircle, ChevronDown, ChevronUp, Clock, Shield, ArrowRight, Heart, AlertTriangle, FileText, Award, Zap, BarChart3, Lock, Users, Sparkles, Activity, ThermometerSun } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Screen } from "../App";

interface Props {
  onNavigate: (screen: Screen) => void;
}



const ASSESSMENT_DOMAINS = [
  { 
    icon: AlertTriangle, 
    title: 'Examination Stress & Emotional Regulation', 
    code: 'ESER',
    desc: 'How your child manages exam anxiety, fear of failure, and emotional responses under pressure', 
    color: BRAND.stress 
  },
  { 
    icon: Heart, 
    title: 'Confidence, Self-Concept & Comparison', 
    code: 'CSCC',
    desc: 'Self-belief, academic identity, and how peer comparisons affect performance', 
    color: BRAND.accent 
  },
];

const STRESS_INDICATORS = [
  { label: 'Exam Anxiety', desc: 'Fear and worry before exams' },
  { label: 'Fear of Failure', desc: 'Catastrophic thinking patterns' },
  { label: 'Emotional Recovery', desc: 'Bouncing back from setbacks' },
  { label: 'Confidence Volatility', desc: 'Self-belief fluctuations' },
  { label: 'Comparison Anxiety', desc: 'Peer pressure impact' },
  { label: 'Performance Pressure', desc: 'Handling expectations' },
];

const FAQS = [
  {
    question: 'What is Stress Check?',
    answer: 'Stress Check is a focused 15-20 minute assessment that evaluates your child\'s stress levels and emotional regulation patterns, particularly around examination periods. It covers ESER (Examination Stress & Emotional Regulation) and CSCC (Confidence, Self-Concept & Comparison) domains.',
  },
  {
    question: 'When should my child take this?',
    answer: 'Ideal timing is 4-6 weeks before major exams (boards, JEE, NEET) or whenever you notice signs of exam-related stress, anxiety, or confidence issues.',
  },
  {
    question: 'What if the results show high stress?',
    answer: 'The report includes specific strategies for stress management. For clinically significant stress levels, we recommend consulting with a qualified mental health professional. Our assessment is non-diagnostic.',
  },
  {
    question: 'Is this assessment anonymous?',
    answer: 'All data is encrypted and DPDP Act compliant. Results are only shared with the registered parent/guardian. We do not share data with schools or third parties without explicit consent.',
  },
];

export function StressCheckPage({ onNavigate }: Props) {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Navbar onNavigate={onNavigate} currentScreen="stress-check" />

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
                  <Badge className="bg-red-500/80 text-white border-0 text-sm px-3 py-1.5 font-medium">
                    <AlertTriangle size={14} className="mr-1.5" /> Exam Season
                  </Badge>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight tracking-tight">
                  Stress Check
                </h1>
                <p className="text-2xl font-semibold mb-2" style={{ color: BRAND.accent }}>
                  Examination Stress & Emotional Regulation
                </p>
                <p className="text-white/90 text-lg mb-5 leading-relaxed">
                  Understand how your child handles exam pressure, anxiety, and emotional challenges. Get actionable insights before stress affects performance.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 mb-5">
                  <Button 
                    size="lg"
                    className="text-white font-semibold h-12 px-6 text-base"
                    style={{ backgroundColor: BRAND.accent }}
                    onClick={() => onNavigate('exam-ready-checkout')}
                    data-testid="btn-start-stress-check"
                  >
                    Start Assessment - ₹349 <ArrowRight size={18} className="ml-2" />
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
                    <Heart size={16} style={{ color: BRAND.accent }} /> Stress & Emotions
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
                  { icon: Heart, value: '2', label: 'Domains' },
                  { icon: FileText, value: '30+', label: 'Questions' },
                  { icon: Clock, value: '15-20', label: 'Minutes' },
                  { icon: Activity, value: 'Stress', label: 'Analysis' },
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
              <Badge className="mb-2 font-semibold" style={{ backgroundColor: `${BRAND.stress}20`, color: BRAND.stress }}>
                Stress & Emotional Intelligence
              </Badge>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ color: BRAND.primary }}>
                What We Assess
              </h2>
              <p className="mt-2 max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
                Two critical domains that determine how your child handles exam pressure
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
              <h2 className="text-2xl font-bold" style={{ color: BRAND.primary }}>Stress Indicators We Measure</h2>
              <p className="mt-2" style={{ color: 'var(--text-secondary)' }}>Key behavioral patterns that affect exam performance</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {STRESS_INDICATORS.map((indicator, idx) => (
                <Card key={idx} className="border shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: BRAND.stress }} />
                      <h3 className="font-semibold text-sm" style={{ color: BRAND.primary }}>{indicator.label}</h3>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{indicator.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 px-4" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold" style={{ color: BRAND.primary }}>Warning Signs to Watch For</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { sign: 'Sudden drop in academic performance', severity: 'high' },
                { sign: 'Avoiding discussions about exams', severity: 'medium' },
                { sign: 'Sleep disturbances before tests', severity: 'high' },
                { sign: 'Physical symptoms (headaches, stomach aches)', severity: 'high' },
                { sign: 'Excessive comparison with peers', severity: 'medium' },
                { sign: 'Negative self-talk about abilities', severity: 'medium' },
              ].map((item, idx) => (
                <div 
                  key={idx}
                  className="flex items-center gap-3 p-4 rounded-xl border"
                  style={{ 
                    backgroundColor: 'var(--bg-primary)', 
                    borderColor: item.severity === 'high' ? BRAND.stress : '#f59e0b' 
                  }}
                >
                  <AlertTriangle 
                    size={20} 
                    style={{ color: item.severity === 'high' ? BRAND.stress : '#f59e0b' }} 
                  />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.sign}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 px-4">
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

        <section className="py-16 px-4" style={{ backgroundColor: BRAND.primary }}>
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Don't Let Stress Affect Your Child's Performance
            </h2>
            <p className="text-white/80 mb-6 text-lg">
              Early identification leads to better outcomes
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button 
                size="lg"
                className="h-12 px-8 font-semibold"
                style={{ backgroundColor: BRAND.accent }}
                onClick={() => onNavigate('exam-ready-checkout')}
              >
                Start Stress Check - ₹349
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
