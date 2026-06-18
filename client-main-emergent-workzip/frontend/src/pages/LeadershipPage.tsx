import React from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Screen } from "../App";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Linkedin, Twitter, Mail, Users, Building2, Brain, Globe,
  Heart, Award, GraduationCap, Sparkles, Target, ArrowRight,
  Shield, Briefcase, Star, BookOpen, Rocket, ChevronRight, Lightbulb
} from "lucide-react";

const BRAND = {
  primary: "#344E86",
  accent: "#4ECDC4"
};

interface LeadershipPageProps {
  onNavigate: (screen: Screen) => void;
}

const LEADERSHIP_TEAM = [
  {
    name: "Dr. Vikram Sharma",
    role: "Founder & CEO",
    bio: "Former IIT Delhi professor with 15+ years in educational psychology. Pioneer in applying cognitive science to K-12 education.",
    initials: "VS",
    expertise: ["EdTech Vision", "Cognitive Science", "K-12"],
    linkedin: "#",
    twitter: "#",
    highlight: "15+ years in education"
  },
  {
    name: "Priya Menon",
    role: "Co-Founder & COO",
    bio: "Ex-McKinsey consultant specializing in education sector transformation. Led digital initiatives at leading EdTech platforms.",
    initials: "PM",
    expertise: ["Strategy", "Operations", "Digital Transformation"],
    linkedin: "#",
    twitter: "#",
    highlight: "Ex-McKinsey"
  },
  {
    name: "Arjun Kapoor",
    role: "Chief Technology Officer",
    bio: "Former engineering lead at Google India. Expert in AI/ML systems and scalable education technology platforms.",
    initials: "AK",
    expertise: ["AI/ML", "Platform Architecture", "Scale"],
    linkedin: "#",
    twitter: "#",
    highlight: "Ex-Google India"
  },
  {
    name: "Dr. Anita Deshmukh",
    role: "Chief Science Officer",
    bio: "PhD in Developmental Psychology from Stanford. Designed assessment frameworks adopted by 200+ schools.",
    initials: "AD",
    expertise: ["Assessment Design", "Dev Psychology", "Research"],
    linkedin: "#",
    twitter: "#",
    highlight: "Stanford PhD"
  },
  {
    name: "Rahul Verma",
    role: "VP of Product",
    bio: "Built products at Byju's and Unacademy reaching 10M+ students. Passionate about accessible education.",
    initials: "RV",
    expertise: ["Product Strategy", "UX", "Growth"],
    linkedin: "#",
    twitter: "#",
    highlight: "10M+ students reached"
  },
  {
    name: "Sneha Kulkarni",
    role: "VP of Customer Success",
    bio: "15 years in education sector partnerships. Onboarded 500+ schools to digital transformation programs.",
    initials: "SK",
    expertise: ["Partnerships", "School Onboarding", "Success"],
    linkedin: "#",
    twitter: "#",
    highlight: "500+ schools onboarded"
  }
];

const ADVISORS = [
  {
    name: "Prof. Raghuram Rajan",
    role: "Academic Advisor",
    affiliation: "Former RBI Governor",
    initials: "RR",
    expertise: "Economic Policy & Education Access"
  },
  {
    name: "Dr. Kiran Mazumdar-Shaw",
    role: "Board Member",
    affiliation: "Founder, Biocon",
    initials: "KM",
    expertise: "Innovation & Social Impact"
  },
  {
    name: "Nandan Nilekani",
    role: "Strategic Advisor",
    affiliation: "Co-founder, Infosys",
    initials: "NN",
    expertise: "Technology Scale & Digital India"
  }
];

const TEAM_STATS = [
  { value: '6', label: 'Executive leaders', icon: Users },
  { value: '80+', label: 'Years combined exp.', icon: Award },
  { value: '3', label: 'Advisory board', icon: Star },
  { value: '5', label: 'Countries represented', icon: Globe },
];

const CULTURE_PILLARS = [
  { icon: Heart, title: "Mission-Driven", desc: "Every team member is here because they believe education can be transformed.", color: BRAND.accent },
  { icon: Brain, title: "Research-First", desc: "We let data and science guide our decisions, not assumptions.", color: BRAND.primary },
  { icon: Lightbulb, title: "Bold Innovation", desc: "We encourage wild ideas and disciplined execution in equal measure.", color: '#f59e0b' },
  { icon: Shield, title: "Trust & Transparency", desc: "Open communication and radical honesty are non-negotiable values.", color: '#8b5cf6' },
];

const ROLE_COLORS = [
  BRAND.primary,
  BRAND.accent,
  '#6366f1',
  '#f59e0b',
  '#ec4899',
  '#10b981',
];

export function LeadershipPage({ onNavigate }: LeadershipPageProps) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--bg-primary)" }}>
      <Navbar onNavigate={onNavigate} currentScreen="leadership" />

      <main className="flex-1 pt-20">
        {/* Hero Section */}
        <section className="relative py-14 md:py-20 px-4 overflow-hidden" style={{ backgroundColor: BRAND.primary }} data-testid="leadership-hero-section">
          <div className="absolute inset-0 opacity-[0.05]">
            <div className="absolute top-12 left-[8%] w-48 h-48 rounded-full border border-white" />
            <div className="absolute bottom-12 right-[6%] w-72 h-72 rounded-full border border-white" />
            <div className="absolute top-[30%] right-[25%] w-32 h-32 rounded-full border border-white" />
          </div>

          <div className="max-w-6xl mx-auto relative">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="text-white">
                <div className="flex items-center gap-2 mb-5">
                  <Badge className="bg-white/15 text-white border-0 text-xs px-3 py-1.5 font-medium" data-testid="badge-leadership">
                    <Users size={12} className="mr-1" /> Leadership
                  </Badge>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold mb-3 leading-tight tracking-tight" data-testid="text-leadership-title">
                  Meet the <span style={{ color: BRAND.accent }}>Visionaries</span> Behind MetryxOne
                </h1>
                <p className="text-sm text-white/70 mb-6 leading-relaxed max-w-md" data-testid="text-leadership-desc">
                  A team of educators, technologists, and researchers united by a mission to transform how we understand student potential.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => onNavigate('careers')}
                    className="font-medium text-sm px-5 py-2.5 rounded-xl"
                    style={{ backgroundColor: BRAND.accent, color: '#fff' }}
                    data-testid="btn-join-team"
                  >
                    Join Our Team <ArrowRight size={16} className="ml-1" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onNavigate('about')}
                    className="font-medium text-sm px-5 py-2.5 rounded-xl border-white/30 text-white hover:bg-white/10"
                    data-testid="btn-our-story"
                  >
                    Our Story
                  </Button>
                </div>
              </div>

              <div className="hidden lg:grid grid-cols-3 gap-3">
                {LEADERSHIP_TEAM.slice(0, 6).map((member, i) => (
                  <div
                    key={i}
                    className="rounded-2xl p-4 text-center"
                    style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold text-white mx-auto mb-2"
                      style={{ backgroundColor: ROLE_COLORS[i % ROLE_COLORS.length] }}
                    >
                      {member.initials}
                    </div>
                    <p className="text-white text-xs font-medium truncate">{member.name.split(' ').slice(-1)[0]}</p>
                    <p className="text-white/50 text-[10px] truncate">{member.role.split('&')[0].trim()}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Impact Stats Strip */}
        <section className="py-4 px-4" style={{ backgroundColor: BRAND.accent }} data-testid="leadership-stats-strip">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {TEAM_STATS.map((stat, i) => (
                <div key={i} className="flex items-center justify-center gap-3 py-2" data-testid={`stat-team-${i}`}>
                  <stat.icon size={18} className="text-white/70" />
                  <div>
                    <span className="text-lg font-bold text-white">{stat.value}</span>
                    <span className="text-xs text-white/70 ml-1.5">{stat.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Executive Team */}
        <section className="py-14 px-4" data-testid="leadership-executive-section">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-1 h-6 rounded-full" style={{ backgroundColor: BRAND.accent }} />
              <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Executive Team</h2>
            </div>
            <p className="text-sm mb-8 ml-5" style={{ color: "var(--text-secondary)" }}>
              The leaders driving MetryxOne's mission across education and technology.
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {LEADERSHIP_TEAM.map((member, i) => (
                <Card
                  key={i}
                  className="border-0 shadow-sm hover:shadow-lg transition-all duration-300 group overflow-hidden"
                  style={{ backgroundColor: "var(--bg-primary)" }}
                  data-testid={`card-leader-${i}`}
                >
                  <CardContent className="p-0">
                    <div className="relative p-5 pb-3">
                      <div className="absolute top-0 left-0 w-full h-1 group-hover:h-1.5 transition-all" style={{ backgroundColor: ROLE_COLORS[i % ROLE_COLORS.length] }} />
                      <div className="flex items-start gap-4">
                        <div
                          className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white shrink-0 group-hover:scale-105 transition-transform"
                          style={{ backgroundColor: ROLE_COLORS[i % ROLE_COLORS.length] }}
                        >
                          {member.initials}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }} data-testid={`text-leader-name-${i}`}>
                            {member.name}
                          </h3>
                          <p className="text-xs font-medium" style={{ color: ROLE_COLORS[i % ROLE_COLORS.length] }}>
                            {member.role}
                          </p>
                          <Badge
                            className="text-[9px] px-2 py-0 mt-1.5 font-normal border-0"
                            style={{ backgroundColor: `${ROLE_COLORS[i % ROLE_COLORS.length]}15`, color: ROLE_COLORS[i % ROLE_COLORS.length] }}
                          >
                            {member.highlight}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="px-5 pb-3">
                      <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        {member.bio}
                      </p>
                    </div>

                    <div className="px-5 pb-3">
                      <div className="flex flex-wrap gap-1.5">
                        {member.expertise.map((tag, j) => (
                          <span
                            key={j}
                            className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="px-5 pb-4 flex gap-2 border-t" style={{ borderColor: "var(--bg-secondary)" }}>
                      <a
                        href={member.linkedin}
                        className="mt-3 w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                        style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}
                        data-testid={`link-linkedin-${i}`}
                      >
                        <Linkedin size={14} />
                      </a>
                      <a
                        href={member.twitter}
                        className="mt-3 w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                        style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}
                        data-testid={`link-twitter-${i}`}
                      >
                        <Twitter size={14} />
                      </a>
                      <a
                        href="#"
                        className="mt-3 w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                        style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}
                        data-testid={`link-email-${i}`}
                      >
                        <Mail size={14} />
                      </a>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Board & Advisors */}
        <section className="py-14 px-4" style={{ backgroundColor: "var(--bg-secondary)" }} data-testid="leadership-advisors-section">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-1 h-6 rounded-full" style={{ backgroundColor: BRAND.primary }} />
              <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Board & Advisors</h2>
            </div>
            <p className="text-sm mb-8 ml-5" style={{ color: "var(--text-secondary)" }}>
              Distinguished leaders who guide our strategic direction.
            </p>

            <div className="grid md:grid-cols-3 gap-5">
              {ADVISORS.map((advisor, i) => (
                <Card
                  key={i}
                  className="border-0 shadow-sm hover:shadow-lg transition-all duration-300 group overflow-hidden"
                  style={{ backgroundColor: "var(--bg-primary)" }}
                  data-testid={`card-advisor-${i}`}
                >
                  <CardContent className="p-6 text-center relative">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-1 rounded-b-full" style={{ backgroundColor: BRAND.accent }} />
                    <div
                      className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4 group-hover:scale-105 transition-transform"
                      style={{ backgroundColor: BRAND.primary }}
                    >
                      {advisor.initials}
                    </div>
                    <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }} data-testid={`text-advisor-name-${i}`}>
                      {advisor.name}
                    </h3>
                    <p className="text-xs font-medium mt-0.5" style={{ color: BRAND.accent }}>
                      {advisor.role}
                    </p>
                    <p className="text-[11px] mt-1" style={{ color: "var(--text-secondary)" }}>
                      {advisor.affiliation}
                    </p>
                    <div
                      className="mt-3 py-1.5 px-3 rounded-full text-[10px] font-medium inline-block"
                      style={{ backgroundColor: `${BRAND.primary}10`, color: BRAND.primary }}
                    >
                      {advisor.expertise}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Our Culture */}
        <section className="py-14 px-4" data-testid="leadership-culture-section">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <Badge className="border-0 text-xs px-3 py-1.5 font-medium mb-3" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }}>
                <Sparkles size={12} className="mr-1" /> Our Culture
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                Built on Shared Values
              </h2>
              <p className="text-sm mt-2 max-w-lg mx-auto" style={{ color: "var(--text-secondary)" }}>
                What makes MetryxOne special isn't just what we build — it's how we work together.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
              {CULTURE_PILLARS.map((pillar, i) => (
                <div
                  key={i}
                  className="rounded-2xl p-5 border transition-all hover:shadow-md group"
                  style={{ borderColor: "var(--bg-secondary)", backgroundColor: "var(--bg-primary)" }}
                  data-testid={`card-culture-${i}`}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
                    style={{ backgroundColor: `${pillar.color}15` }}
                  >
                    <pillar.icon size={20} style={{ color: pillar.color }} />
                  </div>
                  <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                    {pillar.title}
                  </h3>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {pillar.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Join CTA */}
        <section className="py-14 px-4" style={{ backgroundColor: BRAND.primary }} data-testid="leadership-cta-section">
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
                Want to Join Our Mission?
              </h2>
              <p className="text-sm text-white/70 mb-6 max-w-md mx-auto">
                We're always looking for passionate people who want to transform education. Explore open roles and become part of our story.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button
                  onClick={() => onNavigate('careers')}
                  className="font-medium text-sm px-6 py-2.5 rounded-xl"
                  style={{ backgroundColor: BRAND.accent, color: '#fff' }}
                  data-testid="btn-view-positions"
                >
                  View Open Positions <ArrowRight size={16} className="ml-1" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onNavigate('contact')}
                  className="font-medium text-sm px-6 py-2.5 rounded-xl border-white/30 text-white hover:bg-white/10"
                  data-testid="btn-contact-us"
                >
                  Contact Us
                </Button>
              </div>
              <div className="flex items-center justify-center gap-6 mt-8">
                {['Equal Opportunity', 'Remote-Friendly', 'Diverse & Inclusive'].map((tag, i) => (
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

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
