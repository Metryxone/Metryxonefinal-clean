import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Screen } from '../App';
import {
  Briefcase, MapPin, Clock, Search, Building2, Users, Award,
  CheckCircle, ChevronRight, Sparkles, GraduationCap, Heart, Shield,
  TrendingUp, Zap, Star, ArrowRight, Globe, Phone, Mail, Target, Brain,
  BookOpen, Home, Filter, Calendar, Upload, FileText, X, Rocket, Lightbulb
} from 'lucide-react';

interface CareersPageProps {
  onNavigate: (screen: Screen | string) => void;
}

interface Job {
  id: string;
  title: string;
  roleCategory: string;
  employmentType: string;
  workMode: string;
  eligibility: string;
  qualifications: string;
  responsibilities: string;
  kpis: string;
  compensationModel: string;
  publishedAt: string;
}

const BRAND = {
  primary: "#0B3C5D",
  accent: "#4ECDC4"
};

const ROLE_ICONS: Record<string, typeof Briefcase> = {
  mentor: Users,
  counselor: Heart,
  trainer: GraduationCap,
  admin: Building2
};

const BENEFITS = [
  {
    icon: TrendingUp,
    title: 'Performance-Based Earnings',
    description: 'Earn based on your impact — no fixed salary ceiling',
    color: BRAND.accent,
  },
  {
    icon: Clock,
    title: 'Flexible Work Hours',
    description: 'Work on your own schedule with complete time freedom',
    color: BRAND.primary,
  },
  {
    icon: GraduationCap,
    title: 'Free Certification',
    description: 'Get trained and certified at zero cost to you',
    color: '#f59e0b',
  },
  {
    icon: Shield,
    title: 'DPDP Compliant',
    description: 'Your data is protected with enterprise-grade security',
    color: '#0B3C5D',
  },
  {
    icon: Globe,
    title: 'Remote-First Culture',
    description: 'Work from anywhere — we value outcomes over hours',
    color: '#4ECDC4',
  },
  {
    icon: Rocket,
    title: 'Career Growth',
    description: 'Clear promotion paths and mentorship from senior leaders',
    color: '#4ECDC4',
  },
];

const TESTIMONIALS = [
  {
    quote: "MetryxOne gave me the flexibility to work while raising my kids. The platform is amazing and the team is supportive!",
    author: "Priya Sharma",
    role: "Academic Mentor, Mumbai",
    rating: 5,
  },
  {
    quote: "The training certification opened doors I never imagined. I went from a school teacher to leading a regional team within a year.",
    author: "Ravi Krishnan",
    role: "Senior Trainer, Bangalore",
    rating: 5,
  },
  {
    quote: "I love the flexibility and the impact-driven culture. Every session I conduct makes a real difference to a student's life.",
    author: "Ananya Gupta",
    role: "Counselor, Delhi NCR",
    rating: 5,
  },
];

const STATS = [
  { value: '50,000+', label: 'Students Impacted', icon: Users },
  { value: '500+', label: 'Partner Schools', icon: Building2 },
  { value: '95%', label: 'Mentor Satisfaction', icon: Star },
  { value: '200+', label: 'Active Mentors', icon: Award },
];

const HIRING_PROCESS = [
  { step: '01', title: 'Apply Online', desc: 'Submit your profile and resume through our portal', icon: FileText },
  { step: '02', title: 'Screening Call', desc: 'A short conversation to understand your background', icon: Phone },
  { step: '03', title: 'Assessment', desc: 'Role-specific evaluation of your skills and approach', icon: Target },
  { step: '04', title: 'Welcome Aboard', desc: 'Onboarding, training, and certification to get you started', icon: Rocket },
];

export function CareersPage({ onNavigate }: CareersPageProps) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterWorkMode, setFilterWorkMode] = useState('all');
  const [heroFormData, setHeroFormData] = useState({
    fullName: '', email: '', phone: '', currentRole: '', experience: '',
    location: '', linkedIn: '', coverLetter: '', consentCaptured: false
  });
  const [heroCvFile, setHeroCvFile] = useState<File | null>(null);
  const [heroSubmitted, setHeroSubmitted] = useState(false);
  const [heroSubmitting, setHeroSubmitting] = useState(false);

  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ['/api/hr/jobs/published'],
  });

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         job.qualifications.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || job.roleCategory === filterCategory;
    const matchesWorkMode = filterWorkMode === 'all' || job.workMode === filterWorkMode;
    return matchesSearch && matchesCategory && matchesWorkMode;
  });

  const handleApply = (job: Job) => {
    setSelectedJob(job);
    setShowApplicationModal(true);
  };

  const handleHeroSubmit = async () => {
    if (!heroFormData.consentCaptured || !heroFormData.fullName || !heroFormData.email || !heroFormData.phone) return;
    setHeroSubmitting(true);
    try {
      const payload: any = {
        fullName: heroFormData.fullName,
        email: heroFormData.email,
        phone: heroFormData.phone,
        currentRole: heroFormData.currentRole,
        experience: heroFormData.experience,
        location: heroFormData.location,
        linkedIn: heroFormData.linkedIn,
        coverLetter: heroFormData.coverLetter,
        consentCaptured: true,
        sourceChannel: 'metryx_careers_hero'
      };
      if (heroCvFile) {
        const reader = new FileReader();
        reader.onload = async () => {
          payload.cvFileName = heroCvFile.name;
          payload.cvFileData = reader.result as string;
          try {
            await fetch('/api/hr/applications/public', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
          } catch {}
          setHeroSubmitted(true);
          setHeroSubmitting(false);
        };
        reader.readAsDataURL(heroCvFile);
      } else {
        try {
          await fetch('/api/hr/applications/public', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        } catch {}
        setHeroSubmitted(true);
        setHeroSubmitting(false);
      }
    } catch {
      setHeroSubmitted(true);
      setHeroSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--bg-primary)" }}>
      <Navbar onNavigate={onNavigate} currentScreen="careers" />

      <main className="flex-1 pt-20">
        {/* Hero Section with Application Form */}
        <section className="relative py-10 px-4 overflow-hidden" style={{ backgroundColor: BRAND.primary }} data-testid="careers-hero-section">
          <div className="absolute inset-0 opacity-[0.04]">
            <div className="absolute top-12 left-[8%] w-48 h-48 rounded-full border border-white" />
            <div className="absolute bottom-12 right-[6%] w-72 h-72 rounded-full border border-white" />
          </div>

          <div className="max-w-6xl mx-auto relative">
            <div className="grid lg:grid-cols-2 gap-8 items-start">
              <div className="text-white pt-4">
                <div className="flex items-center gap-2 mb-4">
                  <Badge className="bg-white/15 text-white border-0 text-xs px-2.5 py-1 font-medium" data-testid="badge-careers">
                    <Briefcase size={12} className="mr-1" /> Careers
                  </Badge>
                  <Badge className="border-0 text-xs px-2.5 py-1 font-medium" style={{ backgroundColor: BRAND.accent, color: '#fff' }}>
                    We're Hiring
                  </Badge>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold mb-3 leading-tight tracking-tight" data-testid="text-careers-title">
                  Join Our <span style={{ color: BRAND.accent }}>Team</span>
                </h1>
                <p className="text-sm text-white/70 mb-6 leading-relaxed max-w-md" data-testid="text-careers-desc">
                  Build the future of education with MetryxOne. We're looking for passionate educators, counselors, and technologists who want to make a real difference.
                </p>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  {[
                    { icon: Users, label: 'Mentors', count: 'Most roles', accent: true },
                    { icon: Heart, label: 'Counselors', count: 'Growing fast', accent: false },
                    { icon: GraduationCap, label: 'Trainers', count: 'New openings', accent: false },
                    { icon: Building2, label: 'Admin', count: 'Key roles', accent: true },
                  ].map((role, i) => (
                    <div
                      key={i}
                      className="rounded-xl p-3 flex items-center gap-2.5"
                      style={{ backgroundColor: role.accent ? 'rgba(78,205,196,0.15)' : 'rgba(255,255,255,0.08)' }}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                        <role.icon size={16} className="text-white" />
                      </div>
                      <div>
                        <p className="text-white text-xs font-medium">{role.label}</p>
                        <p className="text-white/50 text-[9px]">{role.count}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => {
                      const el = document.getElementById('open-positions');
                      el?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="font-medium text-xs px-4 py-2 rounded-lg h-9"
                    style={{ backgroundColor: BRAND.accent, color: '#fff' }}
                    data-testid="btn-view-roles"
                  >
                    View Open Roles <ArrowRight size={14} className="ml-1" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onNavigate('leadership')}
                    className="font-medium text-xs px-4 py-2 rounded-lg h-9 border-white/30 text-white hover:bg-white/10"
                    data-testid="btn-meet-team"
                  >
                    Meet the Team
                  </Button>
                </div>

                <div className="flex items-center gap-4 mt-6">
                  {STATS.map((stat, i) => (
                    <div key={i} className="text-center relative">
                      {i > 0 && <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-px h-6 bg-white/10" />}
                      <p className="text-base font-bold text-white">{stat.value}</p>
                      <p className="text-[8px] text-white/40 uppercase tracking-wider font-medium">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Application Form - Right Side */}
              <div>
                <Card className="border-0 shadow-2xl overflow-hidden" data-testid="careers-hero-form">
                  <div className="h-1" style={{ backgroundColor: BRAND.accent }} />
                  <CardContent className="p-5">
                    {heroSubmitted ? (
                      <div className="text-center py-8">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: `${BRAND.accent}15` }}>
                          <CheckCircle size={28} style={{ color: BRAND.accent }} />
                        </div>
                        <h3 className="text-base font-bold mb-1" style={{ color: "var(--text-primary)" }}>Application Submitted!</h3>
                        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                          We'll review your profile and get back within 48 hours.
                        </p>
                        <Button onClick={() => setHeroSubmitted(false)} size="sm" className="text-xs" style={{ backgroundColor: BRAND.accent, color: '#fff' }}>
                          Submit Another
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="mb-4">
                          <h3 className="text-base font-bold" style={{ color: BRAND.primary }}>Apply Now</h3>
                          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Submit your profile and we'll match you to the right role</p>
                        </div>

                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Full Name *</Label>
                              <Input
                                value={heroFormData.fullName}
                                onChange={(e) => setHeroFormData({ ...heroFormData, fullName: e.target.value })}
                                placeholder="Your name"
                                className="h-9 text-xs rounded-lg"
                                data-testid="input-hero-name"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Email *</Label>
                              <Input
                                type="email"
                                value={heroFormData.email}
                                onChange={(e) => setHeroFormData({ ...heroFormData, email: e.target.value })}
                                placeholder="name@email.com"
                                className="h-9 text-xs rounded-lg"
                                data-testid="input-hero-email"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Phone *</Label>
                              <div className="flex gap-1.5">
                                <span className="h-9 px-2 flex items-center rounded-lg text-[10px] font-medium border" style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-muted)", borderColor: "var(--border-subtle)" }}>+91</span>
                                <Input
                                  type="tel"
                                  value={heroFormData.phone}
                                  onChange={(e) => setHeroFormData({ ...heroFormData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                                  placeholder="10-digit number"
                                  className="h-9 text-xs rounded-lg flex-1"
                                  data-testid="input-hero-phone"
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Location</Label>
                              <Input
                                value={heroFormData.location}
                                onChange={(e) => setHeroFormData({ ...heroFormData, location: e.target.value })}
                                placeholder="City, State"
                                className="h-9 text-xs rounded-lg"
                                data-testid="input-hero-location"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Current Role</Label>
                              <Input
                                value={heroFormData.currentRole}
                                onChange={(e) => setHeroFormData({ ...heroFormData, currentRole: e.target.value })}
                                placeholder="e.g. Teacher, Counselor"
                                className="h-9 text-xs rounded-lg"
                                data-testid="input-hero-role"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Experience</Label>
                              <Select value={heroFormData.experience} onValueChange={(v) => setHeroFormData({ ...heroFormData, experience: v })}>
                                <SelectTrigger className="h-9 text-xs rounded-lg" data-testid="select-hero-experience">
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="0-1">0-1 years</SelectItem>
                                  <SelectItem value="1-3">1-3 years</SelectItem>
                                  <SelectItem value="3-5">3-5 years</SelectItem>
                                  <SelectItem value="5-10">5-10 years</SelectItem>
                                  <SelectItem value="10+">10+ years</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>LinkedIn Profile</Label>
                            <Input
                              value={heroFormData.linkedIn}
                              onChange={(e) => setHeroFormData({ ...heroFormData, linkedIn: e.target.value })}
                              placeholder="https://linkedin.com/in/yourprofile"
                              className="h-9 text-xs rounded-lg"
                              data-testid="input-hero-linkedin"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Cover Note <span className="font-normal">(Optional)</span></Label>
                            <Textarea
                              value={heroFormData.coverLetter}
                              onChange={(e) => setHeroFormData({ ...heroFormData, coverLetter: e.target.value })}
                              placeholder="Why you're interested in joining MetryxOne..."
                              className="text-xs rounded-lg resize-none"
                              rows={2}
                              data-testid="input-hero-cover"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Upload CV/Resume</Label>
                            {!heroCvFile ? (
                              <label className="flex items-center gap-3 p-3 border-2 border-dashed rounded-lg cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors" style={{ borderColor: "var(--border-subtle)" }}>
                                <Upload size={18} style={{ color: "var(--text-muted)" }} />
                                <div>
                                  <span className="text-xs font-medium block" style={{ color: "var(--text-secondary)" }}>Click to upload</span>
                                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>PDF, DOC, DOCX (Max 5MB)</span>
                                </div>
                                <input
                                  type="file"
                                  accept=".pdf,.doc,.docx"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file && file.size <= 5 * 1024 * 1024) setHeroCvFile(file);
                                  }}
                                  data-testid="input-hero-cv"
                                />
                              </label>
                            ) : (
                              <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-subtle)" }}>
                                <div className="flex items-center gap-2">
                                  <FileText size={16} style={{ color: BRAND.accent }} />
                                  <div>
                                    <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{heroCvFile.name}</p>
                                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{(heroCvFile.size / 1024).toFixed(0)} KB</p>
                                  </div>
                                </div>
                                <button onClick={() => setHeroCvFile(null)} className="text-red-400 hover:text-red-500" data-testid="btn-hero-remove-cv">
                                  <X size={14} />
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="p-2.5 rounded-lg" style={{ backgroundColor: "var(--bg-secondary)" }}>
                            <label className="flex items-start gap-2 cursor-pointer">
                              <Checkbox
                                checked={heroFormData.consentCaptured}
                                onCheckedChange={(c) => setHeroFormData({ ...heroFormData, consentCaptured: c as boolean })}
                                className="mt-0.5"
                                data-testid="checkbox-hero-consent"
                              />
                              <span className="text-[10px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                                I consent to MetryxOne processing my data as per the DPDP Act. I understand this may be a performance-based role.
                              </span>
                            </label>
                          </div>

                          <Button
                            onClick={handleHeroSubmit}
                            disabled={heroSubmitting || !heroFormData.fullName || !heroFormData.email || !heroFormData.phone || !heroFormData.consentCaptured}
                            className="w-full h-10 text-xs font-bold rounded-lg text-white"
                            style={{ backgroundColor: BRAND.accent }}
                            data-testid="btn-hero-submit"
                          >
                            {heroSubmitting ? (
                              <span className="flex items-center gap-2">
                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Submitting...
                              </span>
                            ) : (
                              <>Submit Application <ArrowRight size={14} className="ml-1" /></>
                            )}
                          </Button>

                          <p className="text-center text-[9px]" style={{ color: "var(--text-muted)" }}>
                            <Shield size={9} className="inline mr-1" style={{ color: BRAND.accent }} />
                            256-bit SSL · DPDP Compliant · Your data is secure
                          </p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Why Join MetryxOne - Benefits */}
        <section className="py-10 px-4" data-testid="careers-benefits-section">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <Badge className="border-0 text-xs px-3 py-1.5 font-medium mb-3" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }}>
                <Award size={12} className="mr-1" /> Benefits & Perks
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                Why Join MetryxOne?
              </h2>
              <p className="text-sm mt-2 max-w-lg mx-auto" style={{ color: "var(--text-secondary)" }}>
                We invest in our people because they are our greatest asset.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {BENEFITS.map((benefit, i) => (
                <div
                  key={i}
                  className="rounded-2xl p-5 border transition-all hover:shadow-md group"
                  style={{ borderColor: "var(--bg-secondary)", backgroundColor: "var(--bg-primary)" }}
                  data-testid={`card-benefit-${i}`}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
                    style={{ backgroundColor: `${benefit.color}15` }}
                  >
                    <benefit.icon size={20} style={{ color: benefit.color }} />
                  </div>
                  <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                    {benefit.title}
                  </h3>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {benefit.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Open Positions */}
        <section className="py-10 px-4" id="open-positions" style={{ backgroundColor: "var(--bg-secondary)" }} data-testid="careers-positions-section">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-1 h-6 rounded-full" style={{ backgroundColor: BRAND.accent }} />
              <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Open Positions</h2>
            </div>
            <p className="text-sm mb-8 ml-5" style={{ color: "var(--text-secondary)" }}>
              Find a role that matches your passion and expertise.
            </p>

            <div className="grid lg:grid-cols-4 gap-6">
              {/* Filters Sidebar */}
              <div className="lg:col-span-1 space-y-4">
                <div className="rounded-2xl p-4 border" style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--bg-secondary)" }}>
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={16} style={{ color: "var(--text-muted)" }} />
                    <Input
                      placeholder="Search roles..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-10 rounded-lg border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-sm"
                      data-testid="input-search-jobs"
                    />
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "var(--text-muted)" }}>
                        Category
                      </Label>
                      <Select value={filterCategory} onValueChange={setFilterCategory}>
                        <SelectTrigger className="h-9 rounded-lg border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-sm" data-testid="select-category">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          <SelectItem value="mentor">Mentor</SelectItem>
                          <SelectItem value="counselor">Counselor</SelectItem>
                          <SelectItem value="trainer">Trainer</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "var(--text-muted)" }}>
                        Work Mode
                      </Label>
                      <Select value={filterWorkMode} onValueChange={setFilterWorkMode}>
                        <SelectTrigger className="h-9 rounded-lg border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-sm" data-testid="select-work-mode">
                          <SelectValue placeholder="Work Mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Modes</SelectItem>
                          <SelectItem value="remote">Remote</SelectItem>
                          <SelectItem value="hybrid">Hybrid</SelectItem>
                          <SelectItem value="field">Field</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--bg-secondary)" }}>
                    <Label className="text-[10px] font-semibold uppercase tracking-wider mb-2 block" style={{ color: "var(--text-muted)" }}>
                      Quick Select
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'mentor', icon: Users, label: 'Mentors' },
                        { key: 'counselor', icon: Heart, label: 'Counselors' },
                        { key: 'trainer', icon: GraduationCap, label: 'Trainers' },
                        { key: 'admin', icon: Building2, label: 'Admin' },
                      ].map((role) => (
                        <button
                          key={role.key}
                          type="button"
                          onClick={() => setFilterCategory(filterCategory === role.key ? 'all' : role.key)}
                          className="p-2 rounded-xl border transition-all text-center"
                          style={{
                            borderColor: filterCategory === role.key ? BRAND.accent : 'var(--bg-secondary)',
                            backgroundColor: filterCategory === role.key ? `${BRAND.accent}08` : 'transparent',
                          }}
                          data-testid={`filter-role-${role.key}`}
                        >
                          <role.icon
                            size={16}
                            className="mx-auto mb-1"
                            style={{ color: filterCategory === role.key ? BRAND.accent : 'var(--text-muted)' }}
                          />
                          <div className="text-[10px] font-medium" style={{ color: filterCategory === role.key ? BRAND.accent : 'var(--text-secondary)' }}>
                            {role.label}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {(searchQuery || filterCategory !== 'all' || filterWorkMode !== 'all') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setSearchQuery(''); setFilterCategory('all'); setFilterWorkMode('all'); }}
                      className="w-full mt-3 text-xs"
                      style={{ color: BRAND.accent }}
                      data-testid="btn-clear-filters"
                    >
                      Clear All Filters
                    </Button>
                  )}
                </div>

                {/* Quick Apply Card */}
                <div className="rounded-2xl p-5 text-center text-white" style={{ backgroundColor: BRAND.primary }}>
                  <Zap size={24} className="mx-auto mb-2" />
                  <h3 className="font-semibold text-sm mb-1">Quick Apply</h3>
                  <p className="text-[11px] text-white/60 mb-3">
                    Don't see the right role? Submit your profile.
                  </p>
                  <Button
                    className="w-full font-medium text-sm"
                    style={{ backgroundColor: BRAND.accent, color: '#fff' }}
                    onClick={() => onNavigate('registration')}
                    data-testid="btn-quick-apply"
                  >
                    Create Profile
                  </Button>
                </div>

                {/* Contact HR */}
                <div className="rounded-2xl p-4 border" style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--bg-secondary)" }}>
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
                    Contact HR
                  </h4>
                  <div className="space-y-2">
                    <a href="mailto:careers@metryxone.com" className="flex items-center gap-2 text-xs hover:underline" style={{ color: "var(--text-secondary)" }} data-testid="link-hr-email">
                      <Mail size={13} style={{ color: BRAND.accent }} />
                      careers@metryxone.com
                    </a>
                    <a href="tel:+919876543210" className="flex items-center gap-2 text-xs hover:underline" style={{ color: "var(--text-secondary)" }} data-testid="link-hr-phone">
                      <Phone size={13} style={{ color: BRAND.accent }} />
                      +91 98765 43210
                    </a>
                  </div>
                </div>
              </div>

              {/* Job Listings */}
              <div className="lg:col-span-3">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{filteredJobs.length}</span> open position{filteredJobs.length !== 1 ? 's' : ''}
                  </p>
                </div>

                {isLoading ? (
                  <div className="text-center py-16">
                    <div className="w-10 h-10 border-3 rounded-full animate-spin mx-auto mb-3" style={{ borderColor: BRAND.accent, borderTopColor: "transparent" }} />
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading opportunities...</p>
                  </div>
                ) : filteredJobs.length === 0 ? (
                  <div className="text-center py-16 px-6 rounded-2xl" style={{ backgroundColor: "var(--bg-primary)" }}>
                    <Briefcase size={48} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                    <h3 className="font-semibold mb-1 text-sm" style={{ color: "var(--text-primary)" }}>No positions found</h3>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Try adjusting your search or filters</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredJobs.map(job => (
                      <JobCard key={job.id} job={job} onApply={handleApply} onSelect={setSelectedJob} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-10 px-4" data-testid="careers-testimonials-section">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <Badge className="border-0 text-xs px-3 py-1.5 font-medium mb-3" style={{ backgroundColor: `${BRAND.primary}15`, color: BRAND.primary }}>
                <Star size={12} className="mr-1" /> Team Voices
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                Hear From Our Team
              </h2>
              <p className="text-sm mt-2 max-w-lg mx-auto" style={{ color: "var(--text-secondary)" }}>
                Real stories from the people shaping education at MetryxOne.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              {TESTIMONIALS.map((t, i) => (
                <Card
                  key={i}
                  className="border-0 shadow-sm hover:shadow-lg transition-all duration-300 group overflow-hidden"
                  style={{ backgroundColor: "var(--bg-primary)" }}
                  data-testid={`card-testimonial-${i}`}
                >
                  <CardContent className="p-5 relative">
                    <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: i === 0 ? BRAND.accent : i === 1 ? BRAND.primary : '#f59e0b' }} />
                    <div className="flex gap-0.5 mb-3 mt-2">
                      {[...Array(t.rating)].map((_, j) => (
                        <Star key={j} size={13} fill={BRAND.accent} style={{ color: BRAND.accent }} />
                      ))}
                    </div>
                    <p className="text-xs italic leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>
                      "{t.quote}"
                    </p>
                    <div className="flex items-center gap-3 pt-3 border-t" style={{ borderColor: "var(--bg-secondary)" }}>
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: i === 0 ? BRAND.accent : i === 1 ? BRAND.primary : '#f59e0b' }}
                      >
                        {t.author.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{t.author}</p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{t.role}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Hiring Process */}
        <section className="py-10 px-4" style={{ backgroundColor: "var(--bg-secondary)" }} data-testid="careers-process-section">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <Badge className="border-0 text-xs px-3 py-1.5 font-medium mb-3" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }}>
                <Sparkles size={12} className="mr-1" /> How It Works
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                Our Hiring Process
              </h2>
              <p className="text-sm mt-2 max-w-lg mx-auto" style={{ color: "var(--text-secondary)" }}>
                Simple, transparent, and designed to find the best fit for everyone.
              </p>
            </div>

            <div className="grid md:grid-cols-4 gap-4">
              {HIRING_PROCESS.map((step, i) => (
                <div key={i} className="relative" data-testid={`card-process-${i}`}>
                  {i < HIRING_PROCESS.length - 1 && (
                    <div className="hidden md:block absolute top-10 left-[calc(50%+40px)] w-[calc(100%-80px)] h-px" style={{ backgroundColor: BRAND.accent, opacity: 0.3 }} />
                  )}
                  <div className="rounded-2xl p-5 text-center border transition-all hover:shadow-md" style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--bg-secondary)" }}>
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
                      style={{ backgroundColor: `${BRAND.accent}15` }}
                    >
                      <step.icon size={20} style={{ color: BRAND.accent }} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: BRAND.accent }}>
                      Step {step.step}
                    </span>
                    <h3 className="text-sm font-semibold mt-1 mb-1" style={{ color: "var(--text-primary)" }}>
                      {step.title}
                    </h3>
                    <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-10 px-4" style={{ backgroundColor: BRAND.primary }} data-testid="careers-cta-section">
          <div className="max-w-6xl mx-auto relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.05]">
              <div className="absolute top-6 right-[10%] w-36 h-36 rounded-full border border-white" />
              <div className="absolute bottom-6 left-[15%] w-24 h-24 rounded-full border border-white" />
            </div>

            <div className="relative text-center">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                <Rocket size={24} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">
                Ready to Make a Difference?
              </h2>
              <p className="text-sm text-white/70 mb-6 max-w-md mx-auto">
                Join a team that's transforming how we understand and support every student's potential. Your next chapter starts here.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button
                  onClick={() => {
                    const el = document.getElementById('open-positions');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="font-medium text-sm px-6 py-2.5 rounded-xl"
                  style={{ backgroundColor: BRAND.accent, color: '#fff' }}
                  data-testid="btn-cta-browse-roles"
                >
                  Browse Open Roles <ArrowRight size={16} className="ml-1" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onNavigate('contact')}
                  className="font-medium text-sm px-6 py-2.5 rounded-xl border-white/30 text-white hover:bg-white/10"
                  data-testid="btn-cta-contact"
                >
                  Get in Touch
                </Button>
              </div>
              <div className="flex items-center justify-center gap-6 mt-8">
                {['Equal Opportunity', 'DPDP Compliant', 'Performance-Based'].map((tag, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
                    <span className="text-[11px] text-white/50">{tag}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Modals */}
      {selectedJob && !showApplicationModal && (
        <JobDetailModal
          job={selectedJob}
          isOpen={!!selectedJob && !showApplicationModal}
          onClose={() => setSelectedJob(null)}
          onApply={() => setShowApplicationModal(true)}
        />
      )}

      {showApplicationModal && selectedJob && (
        <ApplicationModal
          job={selectedJob}
          isOpen={showApplicationModal}
          onClose={() => {
            setShowApplicationModal(false);
            setSelectedJob(null);
          }}
        />
      )}

      <Footer onNavigate={onNavigate} />
    </div>
  );
}

function JobCard({ job, onApply, onSelect }: { job: Job; onApply: (job: Job) => void; onSelect: (job: Job) => void }) {
  const RoleIcon = ROLE_ICONS[job.roleCategory] || Briefcase;
  const isNew = new Date(job.publishedAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const roleColor = job.roleCategory === 'mentor' ? BRAND.accent
    : job.roleCategory === 'counselor' ? '#4ECDC4'
    : job.roleCategory === 'trainer' ? '#f59e0b'
    : BRAND.primary;

  return (
    <div
      className="rounded-2xl border overflow-hidden transition-all cursor-pointer hover:shadow-md group"
      style={{
        borderColor: "var(--bg-secondary)",
        backgroundColor: "var(--bg-primary)"
      }}
      onClick={() => onSelect(job)}
      data-testid={`card-job-${job.id}`}
    >
      <div className="h-1 w-full" style={{ backgroundColor: roleColor }} />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform"
            style={{ backgroundColor: `${roleColor}15` }}
          >
            <RoleIcon size={18} style={{ color: roleColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>{job.title}</h3>
              {isNew && (
                <Badge className="text-[9px] px-1.5 py-0 border-0" style={{ backgroundColor: BRAND.accent, color: '#fff' }}>
                  New
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              <Badge variant="outline" className="text-[10px] capitalize px-1.5 py-0">{job.roleCategory}</Badge>
              <Badge variant="secondary" className="text-[10px] capitalize px-1.5 py-0">{job.employmentType}</Badge>
              <Badge variant="secondary" className="text-[10px] capitalize px-1.5 py-0 flex items-center gap-0.5">
                <MapPin size={10} />
                {job.workMode === 'remote' ? 'Remote' : job.workMode === 'hybrid' ? 'Hybrid' : 'Field'}
              </Badge>
            </div>
            <p className="text-xs line-clamp-2 mb-3" style={{ color: "var(--text-muted)" }}>
              {job.qualifications || 'Join our team and make an impact in education.'}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-[10px] flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                <Calendar size={10} />
                Posted {new Date(job.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </span>
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onApply(job);
                }}
                className="h-7 text-xs font-medium px-3 rounded-lg"
                style={{ backgroundColor: BRAND.accent, color: '#fff' }}
                data-testid={`btn-apply-${job.id}`}
              >
                Apply <ChevronRight size={12} className="ml-0.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function JobDetailModal({ job, isOpen, onClose, onApply }: {
  job: Job;
  isOpen: boolean;
  onClose: () => void;
  onApply: () => void;
}) {
  const RoleIcon = ROLE_ICONS[job.roleCategory] || Briefcase;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-xl" style={{ backgroundColor: `${BRAND.accent}15` }}>
              <RoleIcon size={24} style={{ color: BRAND.accent }} />
            </div>
            <div>
              <DialogTitle className="text-lg" style={{ color: "var(--text-primary)" }}>{job.title}</DialogTitle>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline" className="capitalize">{job.roleCategory}</Badge>
                <Badge variant="secondary" className="capitalize">{job.employmentType}</Badge>
                <Badge variant="secondary" className="capitalize">{job.workMode}</Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {job.eligibility && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                <Target size={14} style={{ color: BRAND.accent }} /> Eligibility
              </h4>
              <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>{job.eligibility}</p>
            </div>
          )}

          {job.qualifications && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                <GraduationCap size={14} style={{ color: BRAND.accent }} /> Qualifications
              </h4>
              <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>{job.qualifications}</p>
            </div>
          )}

          {job.responsibilities && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                <BookOpen size={14} style={{ color: BRAND.accent }} /> Responsibilities
              </h4>
              <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>{job.responsibilities}</p>
            </div>
          )}

          {job.kpis && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                <TrendingUp size={14} style={{ color: BRAND.accent }} /> Performance Expectations
              </h4>
              <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>{job.kpis}</p>
            </div>
          )}

          {job.compensationModel && (
            <div className="p-4 rounded-xl" style={{ backgroundColor: `${BRAND.accent}08`, border: `1px solid ${BRAND.accent}30` }}>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: BRAND.accent }}>
                Compensation
              </h4>
              <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}>{job.compensationModel}</p>
            </div>
          )}

          <div className="p-4 rounded-xl" style={{ backgroundColor: "#fef3c7", border: "1px solid #fcd34d" }}>
            <p className="text-xs" style={{ color: "#92400e" }}>
              <strong>Note:</strong> This is a performance-based role. Earnings are linked to KPIs and are not fixed income.
              Training and certification may be required before activation.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={onApply} style={{ backgroundColor: BRAND.accent, color: '#fff' }} data-testid="btn-apply-modal">
            Apply for This Role <ArrowRight size={16} className="ml-1" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApplicationModal({ job, isOpen, onClose }: { job: Job; isOpen: boolean; onClose: () => void }) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    coverLetter: '',
    consentCaptured: false
  });
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const applyMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/hr/applications/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to submit application');
      }
      return response.json();
    },
    onSuccess: () => {
      setSubmitted(true);
    }
  });

  const handleSubmit = async () => {
    if (!formData.consentCaptured || !cvFile) return;

    const reader = new FileReader();
    reader.onload = () => {
      const cvBase64 = reader.result as string;
      applyMutation.mutate({
        jobId: job.id,
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        coverLetter: formData.coverLetter,
        cvFileName: cvFile.name,
        cvFileData: cvBase64,
        consentCaptured: true,
        sourceChannel: 'metryx_careers'
      });
    };
    reader.readAsDataURL(cvFile);
  };

  if (submitted) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${BRAND.accent}15` }}>
              <CheckCircle size={32} style={{ color: BRAND.accent }} />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Application Submitted!</h3>
            <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
              Thank you for applying for <strong>{job.title}</strong>.
              We will review your application and get back to you within 48 hours.
            </p>
            <Button onClick={onClose} style={{ backgroundColor: BRAND.accent, color: '#fff' }}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle style={{ color: "var(--text-primary)" }}>Apply for {job.title}</DialogTitle>
          <DialogDescription>Complete the form below to submit your application.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Full Name *
            </Label>
            <Input
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              placeholder="Enter your full name"
              className="h-11 rounded-lg border-[var(--border-subtle)] bg-[var(--bg-primary)]"
              data-testid="input-applicant-name"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Email Address *
            </Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="name@example.com"
              className="h-11 rounded-lg border-[var(--border-subtle)] bg-[var(--bg-primary)]"
              data-testid="input-applicant-email"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Phone Number *
            </Label>
            <div className="flex gap-2">
              <div
                className="h-11 px-3 flex items-center gap-1.5 rounded-lg border text-sm"
                style={{
                  borderColor: "var(--border-subtle)",
                  backgroundColor: "var(--bg-secondary)",
                  color: "var(--text-secondary)"
                }}
              >
                <Phone size={14} />
                <span>+91</span>
              </div>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setFormData({ ...formData, phone: value });
                }}
                placeholder="10-digit number"
                className="flex-1 h-11 rounded-lg border-[var(--border-subtle)] bg-[var(--bg-primary)]"
                data-testid="input-applicant-phone"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Why are you interested? <span className="font-normal">(Optional)</span>
            </Label>
            <Textarea
              value={formData.coverLetter}
              onChange={(e) => setFormData({ ...formData, coverLetter: e.target.value })}
              placeholder="Tell us why you're excited about this role..."
              className="rounded-lg border-[var(--border-subtle)] bg-[var(--bg-primary)]"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Upload CV/Resume *
            </Label>
            {!cvFile ? (
              <label
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <Upload size={24} className="mb-2" style={{ color: "var(--text-muted)" }} />
                <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  Click to upload or drag and drop
                </span>
                <span className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  PDF, DOC, DOCX (Max 5MB)
                </span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && file.size <= 5 * 1024 * 1024) {
                      setCvFile(file);
                    } else if (file) {
                      alert('File size must be less than 5MB');
                    }
                  }}
                  data-testid="input-cv-upload"
                />
              </label>
            ) : (
              <div
                className="flex items-center justify-between p-3 rounded-lg"
                style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-subtle)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}15` }}>
                    <FileText size={20} style={{ color: BRAND.accent }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{cvFile.name}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{(cvFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCvFile(null)}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  data-testid="btn-remove-cv"
                >
                  <X size={16} />
                </Button>
              </div>
            )}
          </div>

          <div className="p-4 rounded-xl" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-subtle)" }}>
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                id="consent"
                checked={formData.consentCaptured}
                onCheckedChange={(checked) => setFormData({ ...formData, consentCaptured: checked as boolean })}
                className="mt-0.5"
                data-testid="checkbox-consent"
              />
              <span className="text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                I understand that this is a performance-based role with KPI-linked earnings.
                I consent to MetryxOne processing my application data in accordance with the Digital Personal Data Protection Act, 2023.
                I acknowledge that membership/training fees may apply.
              </span>
            </label>
          </div>

          {applyMutation.isError && (
            <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
              {applyMutation.error?.message || 'Failed to submit application. Please try again.'}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!formData.fullName || !formData.email || !formData.phone || !cvFile || !formData.consentCaptured || applyMutation.isPending}
            style={{ backgroundColor: BRAND.accent, color: '#fff' }}
            data-testid="btn-submit-application"
          >
            {applyMutation.isPending ? (
              <span className="flex items-center gap-2">
                <Zap size={16} className="animate-pulse" />
                Submitting...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Zap size={16} />
                Submit Application
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CareersPage;
