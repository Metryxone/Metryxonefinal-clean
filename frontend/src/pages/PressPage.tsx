import React from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Screen } from "../App";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Newspaper, Download, Mail, ExternalLink, Calendar, Award,
  TrendingUp, FileText, Image, ArrowRight, Rocket, Star,
  Users, Building2, Globe, Brain, Sparkles, ChevronRight,
  BookOpen, Shield, Quote, Eye, Play
} from "lucide-react";

const BRAND = {
  primary: "#344E86",
  accent: "#4ECDC4"
};

interface PressPageProps {
  onNavigate: (screen: Screen) => void;
}

const PRESS_STATS = [
  { value: '40+', label: 'Media features', icon: Newspaper },
  { value: '4', label: 'Industry awards', icon: Award },
  { value: '12', label: 'Press releases', icon: FileText },
  { value: '100K+', label: 'Readers reached', icon: Eye },
];

const PRESS_RELEASES = [
  {
    date: "January 2026",
    title: "MetryxOne Launches EXAM READY™ Assessment for Board Exam Students",
    excerpt: "New psychometric assessment helps students understand and optimize their exam readiness beyond academic preparation.",
    source: "Press Release",
    tag: "Product Launch",
    tagColor: BRAND.accent
  },
  {
    date: "December 2025",
    title: "MetryxOne Partners with 200+ Schools Across Maharashtra",
    excerpt: "Expansion brings behavioral intelligence assessments to over 50,000 students in the state.",
    source: "Press Release",
    tag: "Partnership",
    tagColor: BRAND.primary
  },
  {
    date: "November 2025",
    title: "MetryxOne Raises Series A Funding to Expand Nationwide",
    excerpt: "Investment led by Sequoia India to accelerate product development and school partnerships.",
    source: "TechCrunch",
    tag: "Funding",
    tagColor: '#f59e0b'
  },
  {
    date: "October 2025",
    title: "MetryxOne Wins EdTech Innovation Award at India Education Summit",
    excerpt: "Recognized for pioneering approach to understanding student learning behavior.",
    source: "Education Today",
    tag: "Award",
    tagColor: '#8b5cf6'
  }
];

const MEDIA_COVERAGE = [
  {
    outlet: "Economic Times",
    title: "How MetryxOne is Changing the Way Schools Understand Students",
    date: "Jan 15, 2026",
    logo: "ET",
    color: '#dc2626'
  },
  {
    outlet: "YourStory",
    title: "This EdTech Startup Uses AI to Decode Student Learning Patterns",
    date: "Dec 28, 2025",
    logo: "YS",
    color: '#ea580c'
  },
  {
    outlet: "Forbes India",
    title: "30 Under 30: Dr. Vikram Sharma, MetryxOne Founder",
    date: "Dec 10, 2025",
    logo: "FI",
    color: BRAND.primary
  },
  {
    outlet: "Mint",
    title: "The Rise of Behavioral Intelligence in Indian Education",
    date: "Nov 22, 2025",
    logo: "MT",
    color: '#059669'
  },
  {
    outlet: "India Today",
    title: "MetryxOne's LBI Framework: A New Standard in Education Assessment",
    date: "Nov 5, 2025",
    logo: "IT",
    color: '#b91c1c'
  },
  {
    outlet: "Business Standard",
    title: "EdTech 2.0: Behavioral Intelligence is the Next Big Shift",
    date: "Oct 18, 2025",
    logo: "BS",
    color: '#7c3aed'
  }
];

const AWARDS = [
  { title: "EdTech Innovation Award 2025", org: "India Education Summit", year: "2025", color: BRAND.accent },
  { title: "Best Student Wellbeing Solution", org: "EdTech Asia Awards", year: "2025", color: BRAND.primary },
  { title: "NASSCOM Emerge 50", org: "NASSCOM", year: "2025", color: '#f59e0b' },
  { title: "Top 10 EdTech Startups", org: "Inc42", year: "2024", color: '#8b5cf6' }
];

const MEDIA_RESOURCES = [
  { icon: Image, title: "Brand Assets", desc: "Logos, colors, typography, and official brand guidelines", format: "ZIP • 12MB" },
  { icon: FileText, title: "Company Overview", desc: "Fact sheet, mission, team overview, and key metrics", format: "PDF • 2.4MB" },
  { icon: Newspaper, title: "Executive Bios", desc: "Leadership team profiles, headshots, and backgrounds", format: "PDF • 5.1MB" },
  { icon: BookOpen, title: "Product One-Pager", desc: "LBI assessment, ExamReadiness Index™, and platform features", format: "PDF • 1.8MB" },
  { icon: TrendingUp, title: "Impact Report 2025", desc: "Annual report on student outcomes, school partnerships, and growth", format: "PDF • 8.3MB" },
  { icon: Play, title: "B-Roll & Videos", desc: "Platform demos, founder interview clips, and event footage", format: "MP4 • 450MB" },
];

const FEATURED_QUOTE = {
  quote: "MetryxOne is doing something fundamentally different — they're not just testing what students know, they're understanding how students learn. That distinction will reshape education.",
  author: "Rajesh Nair",
  role: "Education Editor, Economic Times",
};

export function PressPage({ onNavigate }: PressPageProps) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--bg-primary)" }}>
      <Navbar onNavigate={onNavigate} currentScreen="press" />

      <main className="flex-1 pt-20">
        {/* Hero Section */}
        <section className="relative py-14 md:py-20 px-4 overflow-hidden" style={{ backgroundColor: BRAND.primary }} data-testid="press-hero-section">
          <div className="absolute inset-0 opacity-[0.05]">
            <div className="absolute top-12 left-[8%] w-48 h-48 rounded-full border border-white" />
            <div className="absolute bottom-12 right-[6%] w-72 h-72 rounded-full border border-white" />
            <div className="absolute top-[30%] right-[25%] w-32 h-32 rounded-full border border-white" />
          </div>

          <div className="max-w-6xl mx-auto relative">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="text-white">
                <div className="flex items-center gap-2 mb-5">
                  <Badge className="bg-white/15 text-white border-0 text-xs px-3 py-1.5 font-medium" data-testid="badge-press">
                    <Newspaper size={12} className="mr-1" /> Press & Media
                  </Badge>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold mb-3 leading-tight tracking-tight" data-testid="text-press-title">
                  MetryxOne in the <span style={{ color: BRAND.accent }}>News</span>
                </h1>
                <p className="text-sm text-white/70 mb-6 leading-relaxed max-w-md" data-testid="text-press-desc">
                  Coverage, press releases, and media resources about our mission to transform education intelligence.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    className="font-medium text-sm px-5 py-2.5 rounded-xl"
                    style={{ backgroundColor: BRAND.accent, color: '#fff' }}
                    data-testid="btn-download-media-kit"
                  >
                    <Download size={16} className="mr-1.5" /> Download Media Kit
                  </Button>
                  <Button
                    variant="outline"
                    className="font-medium text-sm px-5 py-2.5 rounded-xl border-white/30 text-white hover:bg-white/10"
                    onClick={() => window.location.href = 'mailto:press@metryx.one'}
                    data-testid="btn-press-inquiries"
                  >
                    <Mail size={16} className="mr-1.5" /> Press Inquiries
                  </Button>
                </div>
              </div>

              <div className="hidden lg:block">
                <div className="rounded-2xl p-6" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                  <div className="flex items-start gap-3 mb-4">
                    <Quote size={24} style={{ color: BRAND.accent }} className="shrink-0 mt-1" />
                    <p className="text-white/80 text-sm italic leading-relaxed">
                      "{FEATURED_QUOTE.quote}"
                    </p>
                  </div>
                  <div className="flex items-center gap-3 pl-9">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: BRAND.accent }}>
                      {FEATURED_QUOTE.author.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="text-white text-xs font-medium">{FEATURED_QUOTE.author}</p>
                      <p className="text-white/50 text-[10px]">{FEATURED_QUOTE.role}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Strip */}
        <section className="py-4 px-4" style={{ backgroundColor: BRAND.accent }} data-testid="press-stats-strip">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {PRESS_STATS.map((stat, i) => (
                <div key={i} className="flex items-center justify-center gap-3 py-2" data-testid={`stat-press-${i}`}>
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

        {/* Press Releases */}
        <section className="py-14 px-4" data-testid="press-releases-section">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-1 h-6 rounded-full" style={{ backgroundColor: BRAND.accent }} />
              <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Press Releases</h2>
            </div>
            <p className="text-sm mb-8 ml-5" style={{ color: "var(--text-secondary)" }}>
              Official announcements and milestones from MetryxOne.
            </p>

            <div className="space-y-4">
              {PRESS_RELEASES.map((release, i) => (
                <Card
                  key={i}
                  className="border-0 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer group overflow-hidden"
                  style={{ backgroundColor: "var(--bg-primary)" }}
                  data-testid={`card-press-release-${i}`}
                >
                  <CardContent className="p-0">
                    <div className="h-1 w-full" style={{ backgroundColor: release.tagColor }} />
                    <div className="p-5">
                      <div className="flex flex-col md:flex-row md:items-start gap-4">
                        <div className="shrink-0 flex flex-col items-center md:items-start gap-2">
                          <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                            <Calendar size={12} />
                            {release.date}
                          </div>
                          <Badge
                            className="text-[9px] px-2 py-0 border-0 font-medium"
                            style={{ backgroundColor: `${release.tagColor}15`, color: release.tagColor }}
                          >
                            {release.tag}
                          </Badge>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-sm mb-1 group-hover:underline" style={{ color: "var(--text-primary)" }}>
                            {release.title}
                          </h3>
                          <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                            {release.excerpt}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}
                          >
                            {release.source}
                          </span>
                          <ExternalLink size={14} className="group-hover:scale-110 transition-transform" style={{ color: "var(--text-muted)" }} />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Media Coverage */}
        <section className="py-14 px-4" style={{ backgroundColor: "var(--bg-secondary)" }} data-testid="press-coverage-section">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-1 h-6 rounded-full" style={{ backgroundColor: BRAND.primary }} />
              <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Media Coverage</h2>
            </div>
            <p className="text-sm mb-8 ml-5" style={{ color: "var(--text-secondary)" }}>
              What leading publications are saying about MetryxOne.
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {MEDIA_COVERAGE.map((item, i) => (
                <Card
                  key={i}
                  className="border-0 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer group overflow-hidden"
                  style={{ backgroundColor: "var(--bg-primary)" }}
                  data-testid={`card-media-${i}`}
                >
                  <CardContent className="p-0">
                    <div className="h-1 w-full" style={{ backgroundColor: item.color }} />
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white"
                            style={{ backgroundColor: item.color }}
                          >
                            {item.logo}
                          </div>
                          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: item.color }}>
                            {item.outlet}
                          </span>
                        </div>
                        <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--text-muted)" }} />
                      </div>
                      <h3 className="text-sm font-semibold leading-snug mb-3 group-hover:underline" style={{ color: "var(--text-primary)" }}>
                        {item.title}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                        <Calendar size={11} />
                        {item.date}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Awards & Recognition */}
        <section className="py-14 px-4" data-testid="press-awards-section">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <Badge className="border-0 text-xs px-3 py-1.5 font-medium mb-3" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }}>
                <Award size={12} className="mr-1" /> Recognition
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                Awards & Achievements
              </h2>
              <p className="text-sm mt-2 max-w-lg mx-auto" style={{ color: "var(--text-secondary)" }}>
                Industry recognition for our commitment to transforming education.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {AWARDS.map((award, i) => (
                <div
                  key={i}
                  className="rounded-2xl p-5 border text-center transition-all hover:shadow-md group"
                  style={{ borderColor: "var(--bg-secondary)", backgroundColor: "var(--bg-primary)" }}
                  data-testid={`card-award-${i}`}
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform"
                    style={{ backgroundColor: `${award.color}15` }}
                  >
                    <Award size={24} style={{ color: award.color }} />
                  </div>
                  <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                    {award.title}
                  </h3>
                  <p className="text-[11px] mb-2" style={{ color: "var(--text-secondary)" }}>
                    {award.org}
                  </p>
                  <Badge
                    className="text-[9px] px-2 py-0 border-0 font-medium"
                    style={{ backgroundColor: `${award.color}15`, color: award.color }}
                  >
                    {award.year}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Media Resources */}
        <section className="py-14 px-4" style={{ backgroundColor: "var(--bg-secondary)" }} data-testid="press-resources-section">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-1 h-6 rounded-full" style={{ backgroundColor: BRAND.accent }} />
              <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Media Resources</h2>
            </div>
            <p className="text-sm mb-8 ml-5" style={{ color: "var(--text-secondary)" }}>
              Download official assets, reports, and materials for your coverage.
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {MEDIA_RESOURCES.map((resource, i) => (
                <Card
                  key={i}
                  className="border-0 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer group overflow-hidden"
                  style={{ backgroundColor: "var(--bg-primary)" }}
                  data-testid={`card-resource-${i}`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"
                        style={{ backgroundColor: `${BRAND.primary}10` }}
                      >
                        <resource.icon size={22} style={{ color: BRAND.primary }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold mb-0.5" style={{ color: "var(--text-primary)" }}>
                          {resource.title}
                        </h3>
                        <p className="text-[11px] leading-relaxed mb-2" style={{ color: "var(--text-secondary)" }}>
                          {resource.desc}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
                            {resource.format}
                          </span>
                          <Download size={14} className="opacity-60 group-hover:opacity-100 transition-opacity" style={{ color: BRAND.accent }} />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-14 px-4" style={{ backgroundColor: BRAND.primary }} data-testid="press-cta-section">
          <div className="max-w-6xl mx-auto relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.05]">
              <div className="absolute top-6 right-[10%] w-36 h-36 rounded-full border border-white" />
              <div className="absolute bottom-6 left-[15%] w-24 h-24 rounded-full border border-white" />
            </div>

            <div className="relative text-center">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                <Mail size={24} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">
                Media Contact
              </h2>
              <p className="text-sm text-white/70 mb-4 max-w-md mx-auto">
                For press inquiries, interviews, expert commentary, and media requests, reach out to our communications team.
              </p>
              <a
                href="mailto:press@metryx.one"
                className="inline-block text-lg font-semibold mb-6 hover:underline"
                style={{ color: BRAND.accent }}
                data-testid="link-press-email"
              >
                press@metryx.one
              </a>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button
                  className="font-medium text-sm px-6 py-2.5 rounded-xl"
                  style={{ backgroundColor: BRAND.accent, color: '#fff' }}
                  data-testid="btn-cta-media-kit"
                >
                  <Download size={16} className="mr-1.5" /> Download Media Kit
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onNavigate('contact')}
                  className="font-medium text-sm px-6 py-2.5 rounded-xl border-white/30 text-white hover:bg-white/10"
                  data-testid="btn-cta-contact"
                >
                  Contact Us
                </Button>
              </div>
              <div className="flex items-center justify-center gap-6 mt-8">
                {['24hr Response Time', 'Interview Requests Welcome', 'Embargoed Access Available'].map((tag, i) => (
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
