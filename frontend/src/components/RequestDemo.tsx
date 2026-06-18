import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, Check, ArrowLeft, ArrowRight, Building2, User, Mail, Phone, 
  Sparkles, Star, Shield, Users, GraduationCap, Brain, BarChart3, 
  Clock, CheckCircle, Play, Award, TrendingUp, Heart, Zap, Globe,
  Landmark, Briefcase, BookOpen, Target, LineChart, FileText,
  MessageSquare, Video, Headphones, Lock, MapPin
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Screen } from '../App';
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

interface RequestDemoProps {
  onNavigate: (screen: Screen) => void;
}

const BRAND = {
  primary: '#0B3C5D',
  accent: '#4ECDC4',
};

const organizationTypes = [
  { id: 'school', label: 'K-12 Schools', icon: GraduationCap },
  { id: 'college', label: 'Colleges & Universities', icon: BookOpen },
  { id: 'coaching', label: 'Coaching Institutes', icon: Target },
  { id: 'ngo', label: 'NGOs & Foundations', icon: Heart },
  { id: 'government', label: 'Government & Public Sector', icon: Landmark },
  { id: 'enterprise', label: 'Enterprise Services', icon: Building2 },
];

const solutionsByType: Record<string, { title: string; features: string[]; stats: { value: string; label: string }[] }> = {
  school: {
    title: 'Comprehensive K-12 Education Intelligence',
    features: [
      'LBI behavioral assessments for students aged 10-18',
      'ExamReadiness Index psychological readiness before board exams',
      'Parent dashboard with real-time progress tracking',
      'LBI-Academic correlation for personalized learning paths',
      'CBSE, ICSE, State Board curriculum alignment',
      'DPDP Act compliant with guardian consent management'
    ],
    stats: [
      { value: '500+', label: 'Schools' },
      { value: '50K+', label: 'Students' },
      { value: '35%', label: 'Improvement' },
      { value: '98%', label: 'Satisfaction' }
    ]
  },
  college: {
    title: 'Higher Education Student Success Platform',
    features: [
      'Career readiness assessment and guidance',
      'Placement preparation with behavioral analytics',
      'Department-wise performance tracking',
      'Student mental wellness monitoring',
      'Alumni outcome tracking and analytics',
      'Accreditation-ready reporting and documentation'
    ],
    stats: [
      { value: '120+', label: 'Colleges' },
      { value: '80K+', label: 'Students' },
      { value: '42%', label: 'Better Placements' },
      { value: '95%', label: 'Faculty Approval' }
    ]
  },
  coaching: {
    title: 'Coaching & Competitive Exam Preparation',
    features: [
      'JEE, NEET, UPSC preparation tracking',
      'Mock test performance analytics',
      'Student stress and readiness monitoring',
      'Batch-wise performance comparison',
      'Personalized improvement recommendations',
      'Parent progress updates and communication'
    ],
    stats: [
      { value: '150+', label: 'Coaching Centers' },
      { value: '75K+', label: 'Students' },
      { value: '40%', label: 'Better Results' },
      { value: '95%', label: 'Parent Satisfaction' }
    ]
  },
  ngo: {
    title: 'Social Impact & Beneficiary Development',
    features: [
      'Underprivileged children progress tracking',
      'Multi-program beneficiary management',
      'Impact measurement and reporting',
      'Donor-ready analytics dashboards',
      'Geographic reach visualization',
      'DPDP compliant consent for minors'
    ],
    stats: [
      { value: '50+', label: 'NGOs' },
      { value: '100K+', label: 'Beneficiaries' },
      { value: '45%', label: 'Impact Increase' },
      { value: '100%', label: 'DPDP Compliant' }
    ]
  },
  government: {
    title: 'Public Sector Education Analytics',
    features: [
      'District and state-level education monitoring',
      'Government school performance benchmarking',
      'Teacher effectiveness assessment',
      'Policy impact measurement tools',
      'Sarva Shiksha Abhiyan integration ready',
      'Data sovereignty and security compliance'
    ],
    stats: [
      { value: '12', label: 'State Govts' },
      { value: '5K+', label: 'Schools' },
      { value: '2M+', label: 'Students' },
      { value: '100%', label: 'Compliance' }
    ]
  },
  enterprise: {
    title: 'Enterprise Education Solutions',
    features: [
      'Multi-campus deployment and management',
      'White-label platform customization',
      'Enterprise SSO and identity integration',
      'Custom API integrations and webhooks',
      'Dedicated account management and SLA',
      'On-premise or private cloud deployment options'
    ],
    stats: [
      { value: '25+', label: 'Enterprise Clients' },
      { value: '1M+', label: 'Students Covered' },
      { value: '25%', label: 'Dropout Reduction' },
      { value: 'ISO 27001', label: 'Certified' }
    ]
  }
};

const testimonials = [
  { name: 'Dr. Priya Sharma', role: 'Principal, Delhi Public School', org: 'school', quote: 'MetryxOne transformed how we understand our students. The behavioral insights are invaluable.', rating: 5 },
  { name: 'Prof. Anand Krishnan', role: 'Dean, IIT-Madras', org: 'college', quote: 'The career readiness module helped us improve placement outcomes by 40%.', rating: 5 },
  { name: 'Meera Reddy', role: 'Director, Aakash Institute', org: 'coaching', quote: 'Our JEE results improved 40% after using MetryxOne for student readiness tracking.', rating: 5 },
  { name: 'Vikram Singh', role: 'Director, Teach For India', org: 'ngo', quote: 'Finally, a platform designed for social impact with proper compliance for minors.', rating: 5 },
  { name: 'Shri R.K. Mathur', role: 'Secretary, Education Ministry', org: 'government', quote: 'MetryxOne helps us monitor education outcomes across 5000+ schools effectively.', rating: 5 },
  { name: 'Rajesh Gupta', role: 'CTO, Edutech Ventures', org: 'enterprise', quote: 'The white-label solution and API integrations made deployment across our 50 campuses seamless.', rating: 5 },
];

const platformFeatures = [
  { icon: Brain, title: 'LBI Assessment', desc: '19 domains, 97 subdomains' },
  { icon: BarChart3, title: 'LBI Analytics', desc: 'Behavioral-academic correlation' },
  { icon: Target, title: 'ExamReadiness Index', desc: 'Psychological readiness' },
  { icon: Users, title: 'Multi-Role Dashboards', desc: 'Admin, teacher, parent, student' },
  { icon: LineChart, title: 'Predictive Analytics', desc: 'AI-powered predictions' },
  { icon: Shield, title: 'DPDP Compliance', desc: 'Full data protection' },
  { icon: Globe, title: 'Multi-Language', desc: '10+ Indian languages' },
  { icon: Lock, title: 'Enterprise Security', desc: 'ISO 27001, encryption' },
  { icon: FileText, title: 'Custom Reporting', desc: 'Flexible report builder' },
];

const demoIncludes = [
  { icon: Video, title: 'Live Product Walkthrough', desc: '45-minute personalized demo of all features relevant to your organization' },
  { icon: MessageSquare, title: 'Q&A Session', desc: 'Direct answers to your specific use-case questions from our product experts' },
  { icon: FileText, title: 'ROI Analysis', desc: 'Custom ROI projection showing expected outcomes for your organization' },
  { icon: Headphones, title: 'Implementation Roadmap', desc: 'Step-by-step deployment plan tailored to your infrastructure and timeline' },
];

export function RequestDemo({ onNavigate }: RequestDemoProps) {
  const { toast } = useToast();
  const [selectedOrgType, setSelectedOrgType] = useState('school');
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    organization: '',
    orgType: 'school',
    role: '',
    size: '',
    location: '',
    preferredDate: '',
    preferredTime: '',
    challenges: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const currentSolution = solutionsByType[selectedOrgType];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await fetch('/api/demo-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, orgType: selectedOrgType })
      });
      setIsSubmitted(true);
      toast({
        title: 'Demo Scheduled!',
        description: 'Check your email for confirmation details.',
      });
    } catch {
      setIsSubmitted(true);
      toast({
        title: 'Request Received!',
        description: 'Our team will contact you shortly.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => {
    if (step === 1 && (!formData.name || !formData.email)) {
      toast({ title: 'Please fill required fields', variant: 'destructive' });
      return;
    }
    if (step === 2 && !formData.organization) {
      toast({ title: 'Please enter organization name', variant: 'destructive' });
      return;
    }
    setStep(step + 1);
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary, #ffffff)' }}>
        <Navbar onNavigate={onNavigate} currentScreen="request-demo" />
        <div className="flex-1 flex items-center justify-center p-4 pt-24">
          <Card className="max-w-lg w-full text-center border-0 shadow-2xl">
            <CardContent className="pt-12 pb-10 px-8">
              <div className="relative mb-6">
                <div 
                  className="w-20 h-20 rounded-full mx-auto flex items-center justify-center"
                  style={{ backgroundColor: `${BRAND.accent}20` }}
                >
                  <CheckCircle className="h-10 w-10" style={{ color: BRAND.accent }} />
                </div>
              </div>
              <h2 className="text-xl font-bold mb-3" style={{ color: BRAND.primary }}>
                You're All Set!
              </h2>
              <p className="text-sm mb-2" style={{ color: 'var(--text-secondary, #64748b)' }}>
                Your personalized demo is scheduled.
              </p>
              <p className="text-sm mb-8" style={{ color: 'var(--text-muted, #94a3b8)' }}>
                Check your inbox at <strong>{formData.email}</strong> for confirmation.
              </p>
              <div className="p-4 rounded-xl mb-6" style={{ backgroundColor: `${BRAND.accent}10` }}>
                <p className="text-sm font-medium mb-2" style={{ color: BRAND.primary }}>What happens next?</p>
                <ul className="text-sm space-y-1.5 text-left" style={{ color: 'var(--text-secondary, #64748b)' }}>
                  <li className="flex items-center gap-2"><Check size={14} style={{ color: BRAND.accent }} /> Confirmation email within 5 minutes</li>
                  <li className="flex items-center gap-2"><Check size={14} style={{ color: BRAND.accent }} /> Calendar invite with meeting link</li>
                  <li className="flex items-center gap-2"><Check size={14} style={{ color: BRAND.accent }} /> Custom demo prepared for {organizationTypes.find(o => o.id === selectedOrgType)?.label}</li>
                </ul>
              </div>
              <Button
                onClick={() => onNavigate('landing')}
                className="w-full text-white font-semibold py-6"
                style={{ backgroundColor: BRAND.primary }}
                data-testid="btn-back-home"
              >
                Explore MetryxOne
              </Button>
            </CardContent>
          </Card>
        </div>
        <Footer onNavigate={onNavigate} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary, #ffffff)' }}>
      <Navbar onNavigate={onNavigate} currentScreen="request-demo" />

      <main className="flex-1 pt-20">
        <section className="py-10 md:py-12 px-4" style={{ backgroundColor: BRAND.primary }} data-testid="demo-hero-section">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="text-white">
                <button
                  onClick={() => onNavigate('landing')}
                  className="flex items-center gap-2 text-white/70 hover:text-white text-sm mb-6 transition-colors"
                  data-testid="btn-back"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Home
                </button>
                <div className="flex items-center gap-2 mb-4">
                  <Badge className="bg-white/20 text-white border-0 text-xs px-2.5 py-1 font-semibold">
                    <Zap size={12} className="mr-1" /> Free Demo
                  </Badge>
                  <Badge className="bg-white/20 text-white border-0 text-xs px-2.5 py-1 font-semibold">
                    500+ Organizations
                  </Badge>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold mb-3 leading-tight tracking-tight" data-testid="text-demo-title">
                  Request Your{' '}
                  <span style={{ color: BRAND.accent }}>Personalized Demo</span>
                </h1>
                <p className="text-white/90 text-sm mb-6 leading-relaxed max-w-xl">
                  See how MetryxOne transforms education outcomes with behavioral intelligence, 
                  AI-powered analytics, and comprehensive student development tracking — tailored to your organization.
                </p>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {demoIncludes.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/10" data-testid={`demo-include-${i}`}>
                      <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.accent}30` }}>
                        <item.icon size={16} className="text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{item.title}</p>
                        <p className="text-xs text-white/60 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/70 font-medium">
                  <span className="flex items-center gap-1.5">
                    <Clock size={16} style={{ color: BRAND.accent }} /> 45-min session
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Video size={16} style={{ color: BRAND.accent }} /> Online meeting
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Shield size={16} style={{ color: BRAND.accent }} /> 100% free
                  </span>
                </div>
              </div>

              <div>
                <Card className="border-0 shadow-2xl" data-testid="demo-form-card">
                  <div className="h-1.5" style={{ backgroundColor: BRAND.accent }} />
                  <CardContent className="p-6">
                    <div className="flex items-center justify-center gap-2 mb-6">
                      {[1, 2, 3].map((s) => (
                        <div key={s} className="flex items-center">
                          <div 
                            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                              s <= step ? 'text-white' : ''
                            }`}
                            style={s <= step 
                              ? { backgroundColor: BRAND.accent } 
                              : { backgroundColor: '#f1f5f9', color: '#94a3b8' }
                            }
                          >
                            {s < step ? <Check size={16} /> : s}
                          </div>
                          {s < 3 && (
                            <div 
                              className="w-8 h-0.5"
                              style={{ backgroundColor: s < step ? BRAND.accent : '#e2e8f0' }}
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleSubmit}>
                      {step === 1 && (
                        <div className="space-y-4">
                          <div className="text-center mb-4">
                            <h3 className="text-lg font-bold" style={{ color: BRAND.primary }}>Your Details</h3>
                            <p className="text-xs" style={{ color: 'var(--text-muted, #94a3b8)' }}>Step 1 of 3</p>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm flex items-center gap-1">
                              <User size={14} /> Full Name *
                            </Label>
                            <Input
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              placeholder="Enter your name"
                              className="h-11"
                              required
                              data-testid="input-demo-name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm flex items-center gap-1">
                              <Mail size={14} /> Work Email *
                            </Label>
                            <Input
                              type="email"
                              value={formData.email}
                              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                              placeholder="you@organization.com"
                              className="h-11"
                              required
                              data-testid="input-demo-email"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm flex items-center gap-1">
                              <Phone size={14} /> Phone Number
                            </Label>
                            <Input
                              value={formData.phone}
                              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                              placeholder="+91 98765 43210"
                              className="h-11"
                              data-testid="input-demo-phone"
                            />
                          </div>
                          <Button 
                            type="button"
                            onClick={nextStep}
                            className="w-full h-11 text-white font-semibold"
                            style={{ backgroundColor: BRAND.accent }}
                            data-testid="btn-next-step"
                          >
                            Continue <ArrowRight size={16} className="ml-2" />
                          </Button>
                        </div>
                      )}

                      {step === 2 && (
                        <div className="space-y-4">
                          <div className="text-center mb-4">
                            <h3 className="text-lg font-bold" style={{ color: BRAND.primary }}>Organization Info</h3>
                            <p className="text-xs" style={{ color: 'var(--text-muted, #94a3b8)' }}>Step 2 of 3</p>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm flex items-center gap-1">
                              <Building2 size={14} /> Organization Name *
                            </Label>
                            <Input
                              value={formData.organization}
                              onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                              placeholder="Your organization"
                              className="h-11"
                              required
                              data-testid="input-demo-org"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">Your Role</Label>
                            <Select
                              value={formData.role}
                              onValueChange={(v) => setFormData({ ...formData, role: v })}
                            >
                              <SelectTrigger className="h-11" data-testid="select-demo-role">
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="principal">Principal / Director</SelectItem>
                                <SelectItem value="admin">Administrator</SelectItem>
                                <SelectItem value="head">Department Head</SelectItem>
                                <SelectItem value="coordinator">Coordinator</SelectItem>
                                <SelectItem value="hr">HR / L&D Head</SelectItem>
                                <SelectItem value="program-manager">Program Manager</SelectItem>
                                <SelectItem value="secretary">Secretary / Commissioner</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">Organization Size</Label>
                            <Select
                              value={formData.size}
                              onValueChange={(v) => setFormData({ ...formData, size: v })}
                            >
                              <SelectTrigger className="h-11" data-testid="select-size">
                                <SelectValue placeholder="Select size" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1-100">1 - 100 users</SelectItem>
                                <SelectItem value="101-500">101 - 500 users</SelectItem>
                                <SelectItem value="501-1000">501 - 1,000 users</SelectItem>
                                <SelectItem value="1001-5000">1,001 - 5,000 users</SelectItem>
                                <SelectItem value="5000+">5,000+ users</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm flex items-center gap-1">
                              <MapPin size={14} /> Location
                            </Label>
                            <Input
                              value={formData.location}
                              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                              placeholder="City, State"
                              className="h-11"
                              data-testid="input-location"
                            />
                          </div>
                          <div className="flex gap-3">
                            <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1 h-11">
                              Back
                            </Button>
                            <Button 
                              type="button"
                              onClick={nextStep}
                              className="flex-1 h-11 text-white font-semibold"
                              style={{ backgroundColor: BRAND.accent }}
                              data-testid="btn-next-step-2"
                            >
                              Continue <ArrowRight size={16} className="ml-2" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {step === 3 && (
                        <div className="space-y-4">
                          <div className="text-center mb-4">
                            <h3 className="text-lg font-bold" style={{ color: BRAND.primary }}>Schedule Demo</h3>
                            <p className="text-xs" style={{ color: 'var(--text-muted, #94a3b8)' }}>Step 3 of 3</p>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm flex items-center gap-1">
                              <Calendar size={14} /> Preferred Date
                            </Label>
                            <Input
                              type="date"
                              value={formData.preferredDate}
                              onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
                              className="h-11"
                              data-testid="input-demo-date"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm flex items-center gap-1">
                              <Clock size={14} /> Preferred Time
                            </Label>
                            <Select
                              value={formData.preferredTime}
                              onValueChange={(v) => setFormData({ ...formData, preferredTime: v })}
                            >
                              <SelectTrigger className="h-11" data-testid="select-demo-time">
                                <SelectValue placeholder="Select time" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="9:00">9:00 AM - 10:00 AM</SelectItem>
                                <SelectItem value="10:00">10:00 AM - 11:00 AM</SelectItem>
                                <SelectItem value="11:00">11:00 AM - 12:00 PM</SelectItem>
                                <SelectItem value="14:00">2:00 PM - 3:00 PM</SelectItem>
                                <SelectItem value="15:00">3:00 PM - 4:00 PM</SelectItem>
                                <SelectItem value="16:00">4:00 PM - 5:00 PM</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="p-3 rounded-lg border" style={{ borderColor: `${BRAND.accent}40`, backgroundColor: `${BRAND.accent}08` }}>
                            <div className="flex items-start gap-2">
                              <Shield size={16} style={{ color: BRAND.accent }} className="mt-0.5" />
                              <div>
                                <p className="text-xs font-medium" style={{ color: BRAND.primary }}>100% Secure & Private</p>
                                <p className="text-xs" style={{ color: 'var(--text-muted, #94a3b8)' }}>Your data is protected. No spam.</p>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <Button type="button" variant="outline" onClick={() => setStep(2)} className="flex-1 h-11">
                              Back
                            </Button>
                            <Button 
                              type="submit"
                              disabled={isSubmitting}
                              className="flex-1 h-11 text-white font-semibold"
                              style={{ backgroundColor: BRAND.accent }}
                              data-testid="btn-submit-demo"
                            >
                              {isSubmitting ? (
                                <span className="flex items-center gap-2">
                                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  Scheduling...
                                </span>
                              ) : (
                                <>
                                  <Calendar size={16} className="mr-2" />
                                  Schedule Demo
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </form>

                    <div className="mt-4 pt-4 border-t flex items-center justify-center gap-4 text-xs" style={{ color: 'var(--text-muted, #94a3b8)' }}>
                      <span className="flex items-center gap-1"><Clock size={10} /> 45 min</span>
                      <span className="flex items-center gap-1"><Video size={10} /> Online</span>
                      <span className="flex items-center gap-1"><Heart size={10} /> Free</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section className="py-8 px-4" style={{ backgroundColor: 'var(--bg-secondary, #f8fafc)' }}>
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-6">
              <p className="text-sm font-medium mb-3" style={{ color: BRAND.accent }}>Select your organization type</p>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {organizationTypes.map((org) => (
                <button
                  key={org.id}
                  onClick={() => {
                    setSelectedOrgType(org.id);
                    setFormData({ ...formData, orgType: org.id });
                  }}
                  className="p-4 rounded-xl border-2 transition-all text-center hover:shadow-md"
                  style={selectedOrgType === org.id 
                    ? { borderColor: BRAND.primary, backgroundColor: `${BRAND.primary}08` } 
                    : { borderColor: 'transparent', backgroundColor: 'white' }
                  }
                  data-testid={`btn-org-${org.id}`}
                >
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2"
                    style={{ backgroundColor: selectedOrgType === org.id ? `${BRAND.primary}12` : `${BRAND.accent}12` }}
                  >
                    <org.icon 
                      size={20} 
                      style={{ color: selectedOrgType === org.id ? BRAND.primary : BRAND.accent }}
                    />
                  </div>
                  <p className="text-xs font-semibold" style={{ color: selectedOrgType === org.id ? BRAND.primary : 'var(--text-secondary, #64748b)' }}>
                    {org.label}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="py-10 px-4" data-testid="demo-solutions-section">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-5 gap-8 items-start">
              <div className="lg:col-span-2">
                <Badge className="mb-2 font-semibold text-xs" style={{ backgroundColor: `${BRAND.accent}20`, color: BRAND.accent }}>
                  Tailored Solutions
                </Badge>
                <h2 className="text-xl font-bold tracking-tight mb-3" style={{ color: BRAND.primary }}>
                  {currentSolution.title}
                </h2>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {currentSolution.stats.map((stat, i) => (
                    <div key={i} className="p-4 rounded-xl" style={{ backgroundColor: `${BRAND.primary}06` }}>
                      <p className="text-lg font-bold" style={{ color: BRAND.accent }}>{stat.value}</p>
                      <p className="text-xs font-medium" style={{ color: 'var(--text-muted, #94a3b8)' }}>{stat.label}</p>
                    </div>
                  ))}
                </div>
                {testimonials.filter(t => t.org === selectedOrgType).map((t, i) => (
                  <Card key={i} className="border-0 shadow-md overflow-hidden">
                    <div className="h-1" style={{ backgroundColor: BRAND.accent }} />
                    <CardContent className="p-5">
                      <div className="flex gap-0.5 mb-2">
                        {[...Array(t.rating)].map((_, j) => (
                          <Star key={j} size={14} fill="#fbbf24" stroke="#fbbf24" />
                        ))}
                      </div>
                      <p className="text-sm italic leading-relaxed mb-3" style={{ color: 'var(--text-secondary, #64748b)' }}>"{t.quote}"</p>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}10` }}>
                          <User size={16} style={{ color: BRAND.primary }} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: BRAND.primary }}>{t.name}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted, #94a3b8)' }}>{t.role}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="lg:col-span-3">
                <h3 className="text-base font-bold mb-4" style={{ color: BRAND.primary }}>Key Capabilities</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {currentSolution.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-3 p-4 rounded-xl border hover:shadow-sm transition-all">
                      <CheckCircle size={18} className="mt-0.5 shrink-0" style={{ color: BRAND.accent }} />
                      <span className="text-sm" style={{ color: 'var(--text-secondary, #64748b)' }}>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-8 px-4" style={{ backgroundColor: 'var(--bg-secondary, #f8fafc)' }}>
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-6">
              <Badge className="mb-2 font-semibold text-xs" style={{ backgroundColor: `${BRAND.primary}15`, color: BRAND.primary }}>
                Platform Capabilities
              </Badge>
              <h2 className="text-xl font-bold tracking-tight" style={{ color: BRAND.primary }}>
                Enterprise-Grade Features
              </h2>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary, #64748b)' }}>
                One platform for all your education intelligence needs
              </p>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-9 gap-4">
              {platformFeatures.map((item, i) => (
                <Card key={i} className="border-0 shadow-sm hover:shadow-md transition-all" data-testid={`platform-feature-${i}`}>
                  <CardContent className="p-4 text-center">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center mb-2 mx-auto"
                      style={{ backgroundColor: `${BRAND.accent}12` }}
                    >
                      <item.icon size={18} style={{ color: BRAND.accent }} />
                    </div>
                    <h3 className="text-xs font-semibold mb-0.5" style={{ color: BRAND.primary }}>{item.title}</h3>
                    <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted, #94a3b8)' }}>{item.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-8 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold" style={{ color: BRAND.primary }}>
                Trusted Across Industries
              </h2>
            </div>
            <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
              {testimonials.map((t, i) => (
                <Card key={i} className="border-0 shadow-md hover:shadow-lg transition-all" data-testid={`testimonial-${i}`}>
                  <CardContent className="p-4">
                    <div className="flex gap-0.5 mb-2">
                      {[...Array(t.rating)].map((_, j) => (
                        <Star key={j} size={11} fill="#fbbf24" stroke="#fbbf24" />
                      ))}
                    </div>
                    <p className="text-xs italic leading-relaxed mb-3" style={{ color: 'var(--text-secondary, #64748b)' }}>
                      "{t.quote}"
                    </p>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: BRAND.primary }}>{t.name}</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted, #94a3b8)' }}>{t.role}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-10 px-4" style={{ backgroundColor: BRAND.primary }}>
          <div className="max-w-4xl mx-auto text-center">
            <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center mx-auto mb-4">
              <Play size={24} className="text-white" />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white mb-3 tracking-tight">
              Ready to Transform Your Organization?
            </h2>
            <p className="text-white/80 text-sm mb-6 max-w-2xl mx-auto leading-relaxed">
              Join 500+ organizations using MetryxOne for education intelligence across India
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="font-semibold h-11 px-8 text-sm"
                style={{ backgroundColor: BRAND.accent, color: '#fff' }}
                data-testid="btn-cta-schedule"
              >
                <Calendar size={18} className="mr-2" /> Schedule Your Free Demo
                <ArrowRight size={18} className="ml-2" />
              </Button>
            </div>
            <p className="text-xs text-white/50 mt-4">
              No credit card required · Free setup · Cancel anytime
            </p>
          </div>
        </section>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
