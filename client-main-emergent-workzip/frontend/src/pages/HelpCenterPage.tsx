import { useState } from 'react';
import {
  HelpCircle, Search, ArrowRight, BookOpen,
  MessageSquare, Video, FileText, ChevronRight, ChevronDown,
  Users, Shield, Zap, CheckCircle, Star,
  Mail, Clock, Phone, Globe, Settings,
  Brain, Target, Award, Play, Sparkles
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

const CATEGORY_COLORS = [BRAND.accent, BRAND.primary, BRAND.accent, BRAND.primary, BRAND.accent, BRAND.primary];

const FAQ_CATEGORIES = [
  {
    icon: Brain, title: 'LBI Assessments', count: 12,
    items: [
      'What is the Learning Behavior Index (LBI)?',
      'How long does an LBI assessment take?',
      'What age groups does LBI support?',
      'How are assessment results calculated?',
    ],
  },
  {
    icon: Users, title: 'Account & Setup', count: 8,
    items: [
      'How do I create an institute account?',
      'How do I add students to my dashboard?',
      "Can parents access their child's results?",
      'How do I manage user roles and permissions?',
    ],
  },
  {
    icon: Shield, title: 'Privacy & Security', count: 6,
    items: [
      'Is MetryxOne DPDP compliant?',
      'How is student data protected?',
      'What is your data retention policy?',
      'Can I request data deletion?',
    ],
  },
  {
    icon: Settings, title: 'Technical & Integration', count: 10,
    items: [
      'How do I integrate the API?',
      'Which SDKs are available?',
      'How do webhooks work?',
      'What are the API rate limits?',
    ],
  },
  {
    icon: Target, title: 'ExamReady\u2122', count: 7,
    items: [
      'What is the ExamReadiness Index\u2122?',
      'Which exams does ExamReady support?',
      'How accurate are readiness predictions?',
      'Can institutes customize assessments?',
    ],
  },
  {
    icon: Award, title: 'Billing & Plans', count: 5,
    items: [
      'What pricing plans are available?',
      'Do you offer free trials?',
      'How do institutional licenses work?',
      'What payment methods do you accept?',
    ],
  },
];

const VIDEO_TUTORIALS = [
  { title: 'Getting Started with MetryxOne', duration: '4:32', views: '2.1K', category: 'Onboarding' },
  { title: 'Setting Up Your First Assessment', duration: '6:15', views: '1.8K', category: 'Assessments' },
  { title: 'Understanding LBI Reports', duration: '5:48', views: '3.2K', category: 'Reports' },
  { title: 'Parent Dashboard Walkthrough', duration: '3:55', views: '1.5K', category: 'Parents' },
  { title: 'Institute Analytics Overview', duration: '7:22', views: '980', category: 'Analytics' },
  { title: 'API Integration Quick Start', duration: '8:10', views: '760', category: 'Developers' },
];

const STATS = [
  { icon: MessageSquare, value: '48+', label: 'Help Articles' },
  { icon: Video, value: '12+', label: 'Video Tutorials' },
  { icon: Clock, value: '< 4hr', label: 'Avg Response Time' },
  { icon: Star, value: '4.9/5', label: 'Support Satisfaction' },
];

export function HelpCenterPage({ onNavigate }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCat, setExpandedCat] = useState<number | null>(null);

  const filteredCategories = searchQuery
    ? FAQ_CATEGORIES.map((cat, i) => ({
        ...cat,
        originalIndex: i,
        items: cat.items.filter(item =>
          item.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter(cat => cat.items.length > 0)
    : FAQ_CATEGORIES.map((cat, i) => ({ ...cat, originalIndex: i }));

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Navbar onNavigate={onNavigate} currentScreen="help" />

      <main className="flex-1 pt-20">
        {/* Hero */}
        <section className="relative py-14 md:py-20 px-4 overflow-hidden" style={{ backgroundColor: BRAND.primary }} data-testid="help-hero-section">
          <div className="absolute inset-0 opacity-[0.05]">
            <div className="absolute top-12 left-[8%] w-48 h-48 rounded-full border border-white" />
            <div className="absolute bottom-12 right-[6%] w-72 h-72 rounded-full border border-white" />
            <div className="absolute top-[30%] right-[25%] w-32 h-32 rounded-full border border-white" />
          </div>

          <div className="max-w-6xl mx-auto relative">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="text-white">
                <div className="flex items-center gap-2 mb-5">
                  <Badge className="bg-white/15 text-white border-0 text-xs px-3 py-1.5 font-medium" data-testid="badge-help-resource">
                    <HelpCircle size={12} className="mr-1" /> Support
                  </Badge>
                  <Badge className="border-0 text-xs px-3 py-1.5 font-medium" style={{ backgroundColor: BRAND.accent, color: '#fff' }}>
                    Always Available
                  </Badge>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold mb-3 leading-tight tracking-tight" data-testid="text-help-title">
                  Help <span style={{ color: BRAND.accent }}>Center</span>
                </h1>
                <p className="text-base font-medium mb-1 text-white/90" data-testid="text-help-subtitle">
                  FAQs, Troubleshooting Guides & Video Tutorials
                </p>
                <p className="text-sm text-white/65 mb-6 max-w-md leading-relaxed" data-testid="text-help-desc">
                  Find answers to common questions, watch step-by-step tutorials, or reach out to our support team for personalized help.
                </p>
                <div className="relative max-w-md">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    placeholder="Search for help... (e.g., 'LBI assessment', 'reset password')"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border-0 text-sm bg-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2"
                    style={{ '--tw-ring-color': BRAND.accent } as any}
                    data-testid="input-help-search"
                  />
                </div>
              </div>

              {/* Hero Right - Resource Overview Panel */}
              <div className="hidden lg:block">
                <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: BRAND.accent }} />
                    <span className="text-white/50 text-[10px] font-medium uppercase tracking-wider">Support Resources</span>
                  </div>
                  <div className="p-4 space-y-3">
                    {[
                      { icon: BookOpen, text: '48+ help articles across 6 categories', tag: 'Articles' },
                      { icon: Video, text: '12+ video tutorials with step-by-step guides', tag: 'Videos' },
                      { icon: MessageSquare, text: 'Live chat support Mon-Sat, 9am-7pm IST', tag: 'Chat' },
                      { icon: Phone, text: 'Schedule a free 30-minute consultation call', tag: 'Calls' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(78,205,196,0.15)' }}>
                          <item.icon size={15} style={{ color: BRAND.accent }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white/80 text-[11px] leading-snug">{item.text}</p>
                        </div>
                        <span className="text-[9px] px-2 py-0.5 rounded-full font-medium shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
                          {item.tag}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    {[
                      { val: '< 4hr', lbl: 'Response' },
                      { val: '4.9/5', lbl: 'Rating' },
                      { val: '99.9%', lbl: 'Uptime' },
                    ].map((s, i) => (
                      <div key={i} className="text-center">
                        <span className="text-white text-xs font-bold">{s.val}</span>
                        <span className="text-white/40 text-[9px] ml-1">{s.lbl}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Strip */}
        <section className="py-4 px-4" style={{ backgroundColor: BRAND.accent }} data-testid="help-stats-strip">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {STATS.map((stat, i) => (
                <div key={i} className="flex items-center justify-center gap-3 py-2" data-testid={`help-stat-${i}`}>
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

        {/* FAQ Section */}
        <section className="py-14 px-4" data-testid="help-faq-section">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-1 h-6 rounded-full" style={{ backgroundColor: BRAND.accent }} />
              <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }} data-testid="text-help-faq-title">Frequently Asked Questions</h2>
            </div>
            <p className="text-sm mb-8 ml-5" style={{ color: "var(--text-secondary)" }}>
              Browse by category or use the search above to find what you need.
            </p>

            {searchQuery && filteredCategories.length === 0 && (
              <div className="text-center py-12 rounded-2xl" style={{ backgroundColor: "var(--bg-secondary)" }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${BRAND.primary}10` }}>
                  <Search size={28} style={{ color: BRAND.primary }} />
                </div>
                <h3 className="font-semibold mb-1 text-sm" style={{ color: "var(--text-primary)" }}>No results found</h3>
                <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>Try a different search term or browse all categories</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchQuery('')}
                  className="text-xs rounded-xl"
                  style={{ color: BRAND.accent, borderColor: BRAND.accent }}
                >
                  Clear Search
                </Button>
              </div>
            )}

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCategories.map((cat) => {
                const color = CATEGORY_COLORS[cat.originalIndex % CATEGORY_COLORS.length];
                const isExpanded = expandedCat === cat.originalIndex;
                return (
                  <Card
                    key={cat.originalIndex}
                    className="border-0 shadow-sm hover:shadow-lg transition-all duration-300 group overflow-hidden cursor-pointer"
                    style={{ backgroundColor: "var(--bg-primary)" }}
                    onClick={() => setExpandedCat(isExpanded ? null : cat.originalIndex)}
                    data-testid={`help-faq-cat-${cat.originalIndex}`}
                  >
                    <CardContent className="p-0">
                      <div className="h-1 w-full" style={{ backgroundColor: color }} />
                      <div className="p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"
                              style={{ backgroundColor: `${color}15` }}
                            >
                              <cat.icon size={20} style={{ color }} />
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{cat.title}</h3>
                              <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{cat.count} articles</p>
                            </div>
                          </div>
                          <ChevronDown
                            size={16}
                            className="transition-transform"
                            style={{
                              color: isExpanded ? color : 'var(--text-muted)',
                              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            }}
                          />
                        </div>

                        <div className="space-y-1.5">
                          {(isExpanded ? cat.items : cat.items.slice(0, 3)).map((item, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 p-2 rounded-lg transition-colors"
                              style={{ backgroundColor: 'var(--bg-secondary)' }}
                              data-testid={`faq-item-${cat.originalIndex}-${i}`}
                            >
                              <ChevronRight size={11} style={{ color }} className="shrink-0" />
                              <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{item}</span>
                            </div>
                          ))}
                        </div>

                        {!isExpanded && cat.items.length > 3 && (
                          <div className="flex items-center gap-1 mt-3 text-xs font-medium" style={{ color }}>
                            View all {cat.count} articles <ChevronRight size={12} />
                          </div>
                        )}
                        {isExpanded && (
                          <div className="flex items-center gap-1 mt-3 text-xs font-medium" style={{ color }}>
                            View all {cat.count} articles <ArrowRight size={12} />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Video Tutorials */}
        <section className="py-14 px-4" style={{ backgroundColor: 'var(--bg-secondary)' }} data-testid="help-videos-section">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <Badge className="border-0 text-xs px-3 py-1.5 font-medium mb-3" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }} data-testid="badge-help-videos">
                <Video size={12} className="mr-1" /> Video Tutorials
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold" style={{ color: "var(--text-primary)" }} data-testid="text-help-videos-title">
                Watch & Learn
              </h2>
              <p className="text-sm mt-2 max-w-lg mx-auto" style={{ color: "var(--text-secondary)" }}>
                Step-by-step video guides to help you get the most out of MetryxOne.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {VIDEO_TUTORIALS.map((video, i) => {
                const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
                return (
                  <Card
                    key={i}
                    className="border-0 shadow-sm hover:shadow-lg transition-all duration-300 group cursor-pointer overflow-hidden"
                    style={{ backgroundColor: "var(--bg-primary)" }}
                    data-testid={`help-video-${i}`}
                  >
                    <CardContent className="p-0">
                      <div className="h-36 flex items-center justify-center relative" style={{ backgroundColor: `${color}08` }}>
                        <div className="absolute inset-0 opacity-[0.03]">
                          <div className="absolute top-4 right-4 w-16 h-16 rounded-full border" style={{ borderColor: color }} />
                          <div className="absolute bottom-4 left-4 w-10 h-10 rounded-full border" style={{ borderColor: color }} />
                        </div>
                        <div className="h-14 w-14 rounded-2xl flex items-center justify-center bg-white shadow-lg group-hover:scale-110 transition-transform relative z-10">
                          <Play size={22} style={{ color }} className="ml-0.5" />
                        </div>
                        <span className="absolute bottom-3 right-3 text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-black/60 text-white">
                          {video.duration}
                        </span>
                        <Badge className="absolute top-3 left-3 text-[9px] px-2 py-0 border-0 font-medium" style={{ backgroundColor: `${color}20`, color }}>
                          {video.category}
                        </Badge>
                      </div>
                      <div className="p-4">
                        <h4 className="text-sm font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>{video.title}</h4>
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                            <Users size={10} /> {video.views} views
                          </p>
                          <span className="flex items-center gap-1 text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity" style={{ color }}>
                            Watch now <Play size={10} />
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Contact Support CTA */}
        <section className="py-14 px-4" style={{ backgroundColor: BRAND.primary }} data-testid="help-contact-cta-section">
          <div className="max-w-6xl mx-auto relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.05]">
              <div className="absolute top-6 right-[10%] w-36 h-36 rounded-full border border-white" />
              <div className="absolute bottom-6 left-[15%] w-24 h-24 rounded-full border border-white" />
            </div>

            <div className="relative">
              <div className="text-center mb-10">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                  <MessageSquare size={24} className="text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2" data-testid="text-help-contact-title">
                  Still Need <span style={{ color: BRAND.accent }}>Help</span>?
                </h2>
                <p className="text-sm text-white/65 max-w-md mx-auto">
                  Our support team is ready to assist you with any questions or issues.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                {[
                  { icon: Mail, title: 'Email Support', desc: 'support@metryxone.com', sub: 'Average response < 4 hours', action: 'Send Email', color: BRAND.accent },
                  { icon: MessageSquare, title: 'Live Chat', desc: 'Mon-Sat, 9am-7pm IST', sub: 'Instant answers to quick questions', action: 'Start Chat', color: BRAND.accent },
                  { icon: Phone, title: 'Schedule a Call', desc: 'Talk to a product specialist', sub: '30-minute free consultation', action: 'Book Call', color: BRAND.accent },
                ].map((channel, i) => (
                  <div
                    key={i}
                    className="rounded-2xl p-5 text-center text-white transition-all hover:scale-[1.02]"
                    style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                    data-testid={`help-channel-${i}`}
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-3"
                      style={{ backgroundColor: `${channel.color}20` }}
                    >
                      <channel.icon size={20} style={{ color: channel.color }} />
                    </div>
                    <h4 className="text-sm font-semibold mb-1">{channel.title}</h4>
                    <p className="text-xs text-white/80 mb-0.5">{channel.desc}</p>
                    <p className="text-[10px] text-white/50 mb-4">{channel.sub}</p>
                    <Button
                      className="h-8 px-5 text-xs font-medium rounded-xl text-white w-full"
                      style={{ backgroundColor: channel.color }}
                      onClick={() => onNavigate('contact' as Screen)}
                      data-testid={`btn-help-${i}`}
                    >
                      {channel.action} <ArrowRight size={12} className="ml-1" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-center gap-6 mt-8">
                {['DPDP Compliant', 'SOC2 Certified', 'ISO 27001'].map((tag, i) => (
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
