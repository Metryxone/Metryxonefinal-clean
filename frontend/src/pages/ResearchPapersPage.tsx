import {
  FileText, ArrowRight, CheckCircle, BookOpen,
  Brain, Shield, Download, ExternalLink,
  Users, BarChart3, Sparkles, Award,
  ChevronRight, Calendar, Star, Globe
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

const BRAND = {
  primary: '#344E86',
  accent: '#4ECDC4',
};

const PAPERS = [
  {
    title: 'The Learning Behavior Index (LBI): A Multi-Domain Framework for Behavioral Assessment in Education',
    authors: 'Dr. Rajesh Iyer, Dr. Priya Nair, Dr. Sunil Mehta',
    journal: 'Journal of Educational Psychology',
    year: 2025,
    abstract: 'This paper presents the theoretical foundation and validation of the Learning Behavior Index (LBI), a comprehensive framework spanning 19 behavioral domains and 97 subdomains for assessing student learning behavior patterns.',
    tags: ['LBI Framework', 'Validation Study', 'Psychometrics'],
    citations: 47, pages: 32,
  },
  {
    title: 'AI-Adaptive Assessment: Dynamic Question Calibration for Behavioral Profiling Across Age Bands',
    authors: 'Dr. Sunil Mehta, Arjun Patel, Dr. Neha Gupta',
    journal: 'Artificial Intelligence in Education',
    year: 2025,
    abstract: 'Explores the AI-adaptive assessment engine that dynamically calibrates question difficulty, context, and domain coverage based on age band segmentation (A: 6-10, B: 11-14, C: 15-18).',
    tags: ['AI-Adaptive', 'Age Bands', 'Machine Learning'],
    citations: 31, pages: 28,
  },
  {
    title: 'ExamReadiness Index™: Predicting Competitive Exam Performance Through Behavioral Indicators',
    authors: 'Dr. Priya Nair, Vikram Agarwal, Dr. Rajesh Iyer',
    journal: 'Assessment in Education: Principles, Policy & Practice',
    year: 2024,
    abstract: 'Validates the ExamReadiness Index™ as a predictor of competitive exam outcomes (JEE, NEET, UPSC). Demonstrates correlation between behavioral readiness scores and actual exam performance.',
    tags: ['ExamReadiness', 'Prediction Model', 'JEE/NEET'],
    citations: 63, pages: 24,
  },
  {
    title: 'Bias Mitigation in AI-Powered Behavioral Assessments: A DPDP-Compliant Approach',
    authors: 'Dr. Neha Gupta, Dr. Sunil Mehta, Sneha Kapoor',
    journal: 'Ethics in AI & Education',
    year: 2024,
    abstract: 'Presents the bias mitigation strategies employed in MetryxOne assessments, ensuring fairness across gender, socioeconomic background, and regional diversity, while maintaining DPDP compliance.',
    tags: ['Bias Mitigation', 'DPDP Compliance', 'Fairness'],
    citations: 28, pages: 19,
  },
  {
    title: 'Culture-Fit Assessment in Campus Recruitment: Behavioral Signals for Graduate Employability',
    authors: 'Ankit Mehta, Dr. Rajesh Iyer, Meera Joshi',
    journal: 'Human Resource Management Review',
    year: 2024,
    abstract: 'Investigates the use of behavioral competency profiling and culture-fit scoring in campus recruitment. Demonstrates significant reduction in first-year attrition when behavioral data informs hiring decisions.',
    tags: ['Campus Hiring', 'Culture Fit', 'Employability'],
    citations: 22, pages: 21,
  },
  {
    title: 'Longitudinal Behavioral Tracking: Measuring Student Development Across Academic Years',
    authors: 'Dr. Priya Nair, Dr. Sunil Mehta, Dr. Anita Sharma',
    journal: 'Developmental Psychology',
    year: 2025,
    abstract: 'Presents findings from a 3-year longitudinal study tracking behavioral development in 5,000+ students using the LBI framework, demonstrating measurable growth patterns across domains.',
    tags: ['Longitudinal Study', 'Student Development', '5K+ Sample'],
    citations: 18, pages: 36,
  },
];

const RESEARCH_AREAS = [
  { icon: Brain, title: 'Behavioral Science', desc: '19-domain LBI framework development and validation' },
  { icon: Sparkles, title: 'AI & Machine Learning', desc: 'Adaptive assessment engines and predictive models' },
  { icon: Shield, title: 'Ethics & Compliance', desc: 'Bias mitigation, fairness validation, DPDP compliance' },
  { icon: BarChart3, title: 'Educational Analytics', desc: 'Learning pattern analysis and outcome prediction' },
];

export function ResearchPapersPage({ onNavigate }: Props) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Navbar onNavigate={onNavigate} currentScreen="research" />

      <main className="flex-1 pt-20">
        <section className="relative py-14 md:py-20 px-4 overflow-hidden" style={{ backgroundColor: BRAND.primary }} data-testid="research-hero-section">
          <div className="absolute inset-0 opacity-[0.05]">
            <div className="absolute top-12 left-[8%] w-48 h-48 rounded-full border border-white" />
            <div className="absolute bottom-12 right-[6%] w-72 h-72 rounded-full border border-white" />
          </div>
          <div className="max-w-6xl mx-auto relative">
            <div className="max-w-3xl">
              <Badge className="bg-white/15 text-white border-0 text-xs px-3 py-1.5 font-medium mb-5" data-testid="badge-research-resource">
                <FileText size={12} className="mr-1" /> Academic Resource
              </Badge>
              <h1 className="text-3xl md:text-4xl font-bold mb-3 leading-tight tracking-tight text-white" data-testid="text-research-title">
                Research Papers
              </h1>
              <p className="text-base font-medium mb-2 text-white/90" data-testid="text-research-subtitle">
                Scientific Methodology & Validation Behind LBI
              </p>
              <p className="text-sm text-white/65 mb-6 max-w-lg leading-relaxed" data-testid="text-research-desc">
                Peer-reviewed research publications validating the MetryxOne approach to behavioral intelligence
                in education, hiring, and student development.
              </p>
              <div className="flex flex-wrap gap-4 text-xs text-white/60 font-medium">
                <span className="flex items-center gap-1.5"><CheckCircle size={13} style={{ color: BRAND.accent }} /> Peer Reviewed</span>
                <span className="flex items-center gap-1.5"><CheckCircle size={13} style={{ color: BRAND.accent }} /> Open Access</span>
                <span className="flex items-center gap-1.5"><CheckCircle size={13} style={{ color: BRAND.accent }} /> 200+ Citations</span>
              </div>
            </div>
          </div>
        </section>

        <section className="py-10 px-4" data-testid="research-areas-section">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {RESEARCH_AREAS.map((area, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: `${BRAND.primary}04` }} data-testid={`research-area-${i}`}>
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.accent}12` }}>
                    <area.icon size={16} style={{ color: BRAND.accent }} />
                  </div>
                  <div>
                    <p className="text-xs font-bold mb-0.5" style={{ color: BRAND.primary }}>{area.title}</p>
                    <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{area.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-14 px-4" data-testid="research-papers-list">
          <div className="max-w-5xl mx-auto space-y-5">
            <div className="flex items-end justify-between mb-2">
              <div>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }} data-testid="text-research-list-title">
                  Published Research
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{PAPERS.length} papers published</p>
              </div>
            </div>
            {PAPERS.map((paper, idx) => (
              <Card key={idx} className="border-0 shadow-sm hover:shadow-md transition-all group cursor-pointer" data-testid={`research-paper-${idx}`}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: `${BRAND.primary}08` }}>
                      <FileText size={18} style={{ color: BRAND.primary }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold mb-1 leading-snug group-hover:underline" style={{ color: 'var(--text-primary)' }} data-testid={`paper-title-${idx}`}>
                        {paper.title}
                      </h3>
                      <p className="text-[11px] mb-2" style={{ color: 'var(--text-secondary)' }}>
                        {paper.authors}
                      </p>
                      <div className="flex items-center gap-3 mb-2.5 text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                        <span className="flex items-center gap-1"><BookOpen size={10} /> {paper.journal}</span>
                        <span className="flex items-center gap-1"><Calendar size={10} /> {paper.year}</span>
                        <span className="flex items-center gap-1"><Star size={10} /> {paper.citations} citations</span>
                        <span>{paper.pages} pages</span>
                      </div>
                      <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>{paper.abstract}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {paper.tags.map((tag, ti) => (
                          <Badge key={ti} className="text-[9px] border-0 px-2 py-0.5" style={{ backgroundColor: `${BRAND.accent}10`, color: BRAND.accent }}>{tag}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <Button variant="outline" className="h-8 px-3 text-[10px] font-medium rounded-md" style={{ borderColor: `${BRAND.primary}20`, color: BRAND.primary }}>
                        <Download size={11} className="mr-1" /> PDF
                      </Button>
                      <Button variant="outline" className="h-8 px-3 text-[10px] font-medium rounded-md" style={{ borderColor: `${BRAND.accent}20`, color: BRAND.accent }}>
                        <ExternalLink size={11} className="mr-1" /> Cite
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="py-16 px-4" style={{ backgroundColor: BRAND.primary }} data-testid="research-cta-section">
          <div className="max-w-3xl mx-auto text-center">
            <div className="h-12 w-12 rounded-xl bg-white/12 flex items-center justify-center mx-auto mb-5">
              <BookOpen size={24} className="text-white" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 tracking-tight" data-testid="text-research-cta">
              Research <span style={{ color: BRAND.accent }}>Collaboration</span>
            </h2>
            <p className="text-white/65 text-sm mb-8 max-w-lg mx-auto leading-relaxed" data-testid="text-research-cta-desc">
              Interested in collaborating on behavioral intelligence research? We partner with universities and research institutions worldwide.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Button className="h-10 px-8 font-medium text-sm rounded-lg text-white" style={{ backgroundColor: BRAND.accent }} onClick={() => onNavigate('contact')} data-testid="btn-research-cta">
                Propose Collaboration <ArrowRight size={15} className="ml-1.5" />
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
