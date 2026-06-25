import { BRAND } from '@/design-system/tokens';
import {
  Award, ArrowRight, CheckCircle, TrendingUp,
  Users, Brain, GraduationCap, Building2, Heart,
  Target, BarChart3, Sparkles, Zap, Star,
  ChevronRight, Quote, BookOpen, Shield
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Screen } from "../App";

interface Props {
  onNavigate: (screen: Screen) => void;
}



const CASE_STUDIES = [
  {
    category: 'K-12 School',
    title: 'Delhi Public School Reduces Student Stress by 31%',
    org: 'Delhi Public School, Noida',
    challenge: 'High student anxiety during board exam preparation was leading to declining performance and increased dropout risk in grades 10-12.',
    solution: 'Deployed MetryxOne LBI assessments across 1,200 students. Used stress mapping and behavioral profiling to identify at-risk students early.',
    results: [
      { metric: '31%', label: 'Reduction in student stress levels' },
      { metric: '94%', label: 'Parent satisfaction score' },
      { metric: '18%', label: 'Improvement in board exam results' },
    ],
    quote: 'MetryxOne gave us visibility into student wellbeing that we never had before. The early intervention alerts are invaluable.',
    quotePerson: 'Dr. Anita Sharma, Principal',
    color: BRAND.accent, icon: GraduationCap,
  },
  {
    category: 'Coaching Institute',
    title: 'Resonance Academy Improves JEE Selection Rate by 22%',
    org: 'Resonance JEE Academy, Kota',
    challenge: 'Despite strong academic preparation, many students were underperforming in actual JEE exams due to psychological and behavioral factors.',
    solution: 'Implemented ExamReadiness Index™ assessments to measure psychological preparedness, pressure tolerance, and study discipline across all batches.',
    results: [
      { metric: '22%', label: 'Improvement in JEE selection rate' },
      { metric: '340+', label: 'Students assessed per batch' },
      { metric: '45%', label: 'Fewer burnout cases reported' },
    ],
    quote: 'The ExamReadiness scores predicted performance variance with remarkable accuracy. We now optimize preparation, not just teach content.',
    quotePerson: 'Vikram Agarwal, Director',
    color: BRAND.primary, icon: Target,
  },
  {
    category: 'Enterprise Hiring',
    title: 'TechCorp India Cuts Mis-Hire Rate by 34%',
    org: 'TechCorp India Pvt Ltd',
    challenge: 'High mis-hire rate and first-year attrition were costing the company significantly in recruitment, training, and lost productivity.',
    solution: 'Integrated MetryxOne behavioral assessments into the hiring pipeline. Assessed candidates across culture fit, cognitive potential, and role-specific competencies.',
    results: [
      { metric: '34%', label: 'Reduction in mis-hires' },
      { metric: '2.5x', label: 'Faster hiring decisions' },
      { metric: '60%', label: 'Lower first-year attrition' },
    ],
    quote: 'We stopped hiring based on gut feel. MetryxOne\'s behavioral profiling revealed patterns we completely missed in interviews.',
    quotePerson: 'Ankit Mehta, VP Talent Acquisition',
    color: '#8b5cf6', icon: Users,
  },
  {
    category: 'Campus Recruitment',
    title: 'Wipro Assesses 1,200 Graduates Across 5 Universities',
    org: 'Wipro Ltd, Campus Hiring Division',
    challenge: 'Manual screening of thousands of campus candidates was time-consuming and inconsistent across different university placement drives.',
    solution: 'Deployed MetryxOne campus assessments across 5 partner universities simultaneously. AI-powered candidate ranking and culture-fit matching.',
    results: [
      { metric: '1,200', label: 'Candidates assessed in one week' },
      { metric: '28%', label: 'Lower first-year attrition' },
      { metric: '3x', label: 'Faster shortlisting process' },
    ],
    quote: 'The culture-fit scores saved us weeks of manual evaluation. We found the right people faster and they stayed longer.',
    quotePerson: 'Sneha Kapoor, Head of HR',
    color: BRAND.accent, icon: Building2,
  },
  {
    category: 'Parent Success',
    title: 'Parent Discovers Early Learning Anxiety in 8-Year-Old',
    org: 'Sharma Family, Mumbai',
    challenge: 'Their child was performing well academically but showing signs of stress and reluctance to attend school. Traditional assessments showed no issues.',
    solution: 'Used MetryxOne\'s parent-initiated LBI Mini Learning Check to assess behavioral patterns across emotional regulation, social interaction, and learning motivation.',
    results: [
      { metric: 'Early', label: 'Detection of learning anxiety' },
      { metric: '87%', label: 'Improvement in school engagement' },
      { metric: '3 months', label: 'To see meaningful progress' },
    ],
    quote: 'The LBI report showed us exactly what was happening below the surface. Our counselor said the insights were more detailed than any clinical intake.',
    quotePerson: 'Priya Sharma, Parent',
    color: BRAND.primary, icon: Heart,
  },
];

const IMPACT_NUMBERS = [
  { value: '50+', label: 'Organizations served' },
  { value: '25K+', label: 'People assessed' },
  { value: '31%', label: 'Avg stress reduction' },
  { value: '4.8/5', label: 'Client satisfaction' },
];

export function CaseStudiesPage({ onNavigate }: Props) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Navbar onNavigate={onNavigate} currentScreen="case-studies" />

      <main className="flex-1 pt-20">
        <section className="relative py-14 md:py-20 px-4 overflow-hidden" style={{ backgroundColor: BRAND.primary }} data-testid="cases-hero-section">
          <div className="absolute inset-0 opacity-[0.05]">
            <div className="absolute top-12 left-[8%] w-48 h-48 rounded-full border border-white" />
            <div className="absolute bottom-12 right-[6%] w-72 h-72 rounded-full border border-white" />
          </div>
          <div className="max-w-6xl mx-auto relative">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 mb-5">
                <Badge className="bg-white/15 text-white border-0 text-xs px-3 py-1.5 font-medium" data-testid="badge-cases-resource">
                  <Award size={12} className="mr-1" /> Success Stories
                </Badge>
                <Badge className="border-0 text-xs px-3 py-1.5 font-semibold" style={{ backgroundColor: `${BRAND.accent}30`, color: BRAND.accent }} data-testid="badge-cases-updated">
                  UPDATED
                </Badge>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-3 leading-tight tracking-tight text-white" data-testid="text-cases-title">
                Case Studies
              </h1>
              <p className="text-base font-medium mb-2 text-white/90" data-testid="text-cases-subtitle">
                Real Success Stories from Schools, Parents & Institutes
              </p>
              <p className="text-sm text-white/65 mb-6 max-w-lg leading-relaxed" data-testid="text-cases-desc">
                See how organizations and families are using MetryxOne to transform education, hiring,
                and student wellbeing with behavioral intelligence.
              </p>
            </div>
          </div>
        </section>

        <section className="py-10 px-4" data-testid="cases-impact-strip">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {IMPACT_NUMBERS.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: `${BRAND.primary}04` }} data-testid={`cases-impact-${i}`}>
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.accent}12` }}>
                    <Star size={18} style={{ color: BRAND.accent }} />
                  </div>
                  <div>
                    <p className="text-lg font-bold" style={{ color: BRAND.primary }}>{item.value}</p>
                    <p className="text-[11px] leading-tight" style={{ color: 'var(--text-secondary)' }}>{item.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-14 px-4" data-testid="cases-list-section">
          <div className="max-w-5xl mx-auto space-y-8">
            {CASE_STUDIES.map((cs, idx) => (
              <Card key={idx} className="border-0 shadow-md hover:shadow-lg transition-all overflow-hidden" data-testid={`case-study-${idx}`}>
                <div className="h-1.5" style={{ backgroundColor: cs.color }} />
                <CardContent className="p-0">
                  <div className="grid lg:grid-cols-5">
                    <div className="lg:col-span-3 p-6">
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${cs.color}10` }}>
                          <cs.icon size={18} style={{ color: cs.color }} />
                        </div>
                        <div>
                          <Badge className="text-[9px] border-0 px-2 py-0.5 font-medium" style={{ backgroundColor: `${cs.color}12`, color: cs.color }}>{cs.category}</Badge>
                        </div>
                      </div>
                      <h3 className="text-base font-bold mb-1.5 leading-tight" style={{ color: 'var(--text-primary)' }} data-testid={`case-title-${idx}`}>{cs.title}</h3>
                      <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{cs.org}</p>

                      <div className="space-y-3 mb-4">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: BRAND.primary }}>Challenge</p>
                          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{cs.challenge}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: BRAND.accent }}>Solution</p>
                          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{cs.solution}</p>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg border" style={{ borderColor: `${cs.color}15` }} data-testid={`case-quote-${idx}`}>
                        <p className="text-xs italic leading-relaxed mb-2" style={{ color: 'var(--text-secondary)' }}>"{cs.quote}"</p>
                        <p className="text-[10px] font-bold" style={{ color: cs.color }}>— {cs.quotePerson}</p>
                      </div>
                    </div>
                    <div className="lg:col-span-2 p-6 flex flex-col justify-center" style={{ backgroundColor: `${cs.color}04` }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-4" style={{ color: cs.color }}>Key Results</p>
                      <div className="space-y-4">
                        {cs.results.map((r, ri) => (
                          <div key={ri} className="text-center" data-testid={`case-result-${idx}-${ri}`}>
                            <p className="text-2xl font-bold" style={{ color: cs.color }}>{r.metric}</p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{r.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="py-16 px-4" style={{ backgroundColor: BRAND.primary }} data-testid="cases-cta-section">
          <div className="max-w-3xl mx-auto text-center">
            <div className="h-12 w-12 rounded-xl bg-white/12 flex items-center justify-center mx-auto mb-5">
              <Award size={24} className="text-white" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 tracking-tight" data-testid="text-cases-cta">
              Your Success Story <span style={{ color: BRAND.accent }}>Starts Here</span>
            </h2>
            <p className="text-white/65 text-sm mb-8 max-w-lg mx-auto leading-relaxed" data-testid="text-cases-cta-desc">
              Join 50+ organizations transforming their approach with MetryxOne behavioral intelligence.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Button className="h-10 px-8 font-medium text-sm rounded-lg text-white" style={{ backgroundColor: BRAND.accent }} onClick={() => onNavigate('request-demo')} data-testid="btn-cases-cta-demo">
                Request a Demo <ArrowRight size={15} className="ml-1.5" />
              </Button>
              <Button variant="outline" className="h-10 px-8 font-medium text-sm border-white/25 text-white hover:bg-white/10 rounded-lg" onClick={() => onNavigate('contact')} data-testid="btn-cases-cta-contact">
                Contact Sales
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
