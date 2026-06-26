import { BRAND_NAVY as BRAND } from '@/design-system/tokens';
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  MessageCircle, 
  Brain, 
  Users, 
  Clock, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles,
  BookOpen,
  BarChart3,
  Shield,
  Lightbulb,
  Zap,
  Globe,
  GraduationCap,
  HeadphonesIcon,
  Send,
  Bot,
  User,
  Lock,
  Layers,
  Target,
  ChevronRight,
  Play,
  Search,
  TrendingUp,
  AlertTriangle,
  FileText,
  History,
  Star,
  ArrowUpRight,
  Loader2,
} from "lucide-react";



const CAPABILITIES = [
  { icon: Brain, title: 'LBI Interpretation', desc: 'Explains domain scores, subdomain patterns, and what they mean for your child\'s learning journey across all 19 domains.' },
  { icon: BarChart3, title: 'Performance Analysis', desc: 'Breaks down exam results, identifies trends, and highlights areas needing focused attention with data-driven insights.' },
  { icon: BookOpen, title: 'Study Planning', desc: 'Creates personalized study schedules based on learning behavior patterns, upcoming exams, and cognitive strengths.' },
  { icon: Sparkles, title: 'Behavioral Insights', desc: 'Translates complex behavioral data into simple, actionable guidance for parents and educators to act upon.' },
  { icon: Lightbulb, title: 'Exam Strategy', desc: 'Provides exam-specific preparation tips based on the student\'s psychological readiness and stress profile.' },
  { icon: HeadphonesIcon, title: 'Parent Coaching', desc: 'Guides parents on how to support their child without adding pressure, backed by educational psychology research.' },
];

const USE_CASES = [
  { role: 'Parents', icon: Users, color: BRAND.primary, items: [
    'Understand your child\'s LBI report in plain language',
    'Get suggestions for improving specific behavioral domains',
    'Plan effective study schedules around learning patterns',
    'Know when and how to intervene vs. when to step back',
    'Track progress across assessment cycles',
  ]},
  { role: 'Students', icon: GraduationCap, color: BRAND.accent, items: [
    'Get personalized exam preparation strategies',
    'Understand your own learning style and strengths',
    'Build better study habits with AI-guided plans',
    'Manage exam stress with evidence-based techniques',
    'Receive instant answers to academic questions',
  ]},
  { role: 'Educators', icon: BookOpen, color: BRAND.navy, items: [
    'Interpret batch LBI results for classroom interventions',
    'Identify students at risk of underperformance',
    'Design group activities targeting specific domains',
    'Track cohort-level behavioral trends over time',
    'Generate parent communication summaries',
  ]},
];

const SAMPLE_CONVERSATIONS = [
  { 
    q: '"My child scored low on D03 (Emotional Regulation). What does this mean?"', 
    a: 'MetryxAI explains the domain in plain language, identifies specific subdomain patterns (stress reactivity, cognitive control, recovery speed), and suggests age-appropriate strategies for improvement — all personalized to your child\'s age band and profile.',
    tag: 'LBI Interpretation'
  },
  { 
    q: '"How should I prepare my daughter for her board exams?"', 
    a: 'Based on her ExamReadiness profile, MetryxAI creates a personalized preparation plan addressing cognitive readiness, emotional regulation, time management strategy, and stress coping — factoring in her specific strengths and risk areas.',
    tag: 'Exam Strategy'
  },
  { 
    q: '"Why is my son\'s effort not matching his results?"', 
    a: 'MetryxAI analyzes the gap between D07 (Discipline & Habits) and D01 (Academic Effectiveness) to identify behavioral patterns causing the disconnect. It may reveal metacognitive gaps, study strategy issues, or hidden stress factors.',
    tag: 'Root Cause Analysis'
  },
  { 
    q: '"Which domains should we focus on this semester?"', 
    a: 'MetryxAI prioritizes domains based on impact potential and current scores, creating a focused improvement plan with realistic milestones. It considers cross-domain dependencies to maximize growth across related areas.',
    tag: 'Action Planning'
  },
];

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const INSTITUTE_QUICK_PROMPTS = [
  { icon: BarChart3, label: 'Batch LBI Analysis', prompt: 'Analyze the latest LBI batch results for Class 8 and identify the top 3 weakest domains across the cohort.' },
  { icon: AlertTriangle, label: 'At-Risk Students', prompt: 'Which students in Class 10 are showing declining LBI scores over the last 2 assessment cycles?' },
  { icon: TrendingUp, label: 'Domain Trends', prompt: 'Show me the trend analysis for D03 (Emotional Regulation) across all age bands for this semester.' },
  { icon: Users, label: 'Parent Communication', prompt: 'Generate a summary report for parents of Class 7 highlighting key behavioral insights from the recent LBI assessment.' },
  { icon: Brain, label: 'Intervention Plan', prompt: 'Suggest classroom interventions for students scoring below 40 on D05 (Social Competence) in age band B.' },
  { icon: FileText, label: 'Report Summary', prompt: 'Summarize the overall LBI performance of our school compared to the platform benchmark for this quarter.' },
];

const RECENT_CONVERSATIONS = [
  { id: 1, title: 'Class 8A Batch LBI Analysis', preview: 'Analyzed 42 students across 19 domains. Key finding: D03 and D09 need attention...', time: '2 hours ago', messages: 8, starred: true },
  { id: 2, title: 'At-Risk Students - Class 10', preview: 'Identified 6 students with declining scores. Priya S., Rahul K., and Meera T. show...', time: '5 hours ago', messages: 12, starred: false },
  { id: 3, title: 'Parent Report - Class 7', preview: 'Generated parent-friendly summary for 38 students covering emotional regulation and...', time: 'Yesterday', messages: 5, starred: true },
  { id: 4, title: 'D05 Intervention Strategies', preview: 'Recommended 4 group activities and 2 individual exercises for social competence...', time: 'Yesterday', messages: 6, starred: false },
  { id: 5, title: 'Quarterly Benchmark Comparison', preview: 'School average 68.4 vs platform benchmark 65.2. Strong in D01, D07. Below average in...', time: '2 days ago', messages: 10, starred: false },
];

interface MetryxAIAssistantPageProps {
  role?: 'parent' | 'institute';
  onOpenChat?: () => void;
  onNavigate?: (screen: string) => void;
}

export function MetryxAIAssistantPage({ role = 'parent', onOpenChat, onNavigate }: MetryxAIAssistantPageProps) {
  if (role === 'institute') {
    return <InstituteDashboard onOpenChat={onOpenChat} onNavigate={onNavigate} />;
  }

  return (
    <div className="space-y-8" data-testid="metryxai-assistant-page">
      <section className="relative overflow-hidden rounded-xl" style={{ backgroundColor: BRAND.primary }} data-testid="metryxai-hero">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full opacity-[0.04] bg-white" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-[0.03] bg-white" />
        </div>

        <div className="relative p-6 md:p-8">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div className="text-white">
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-2xs font-semibold tracking-wide uppercase bg-white/10 text-white/90">
                  <MessageCircle size={11} /> AI Assistant
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-2xs font-semibold tracking-wide uppercase" style={{ backgroundColor: 'rgba(78,205,196,0.2)', color: BRAND.accent }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                  Always On
                </span>
              </div>

              <h1 className="text-2xl md:text-3xl font-bold text-white leading-[1.1] tracking-tight mb-2" data-testid="text-metryxai-title">
                MetryxAI <span style={{ color: BRAND.accent }}>Assistant</span>
              </h1>

              <p className="text-sm text-white/80 mb-1.5 font-medium">
                Your 24/7 AI Guide for Education & Behavioral Intelligence
              </p>
              <p className="text-xs text-white/50 mb-5 leading-relaxed max-w-md">
                MetryxAI understands LBI data, exam patterns, and learning science to provide 
                personalized guidance for parents, students, and educators — instantly, in any language.
              </p>

              <div className="flex flex-wrap gap-2 mb-5">
                <Button 
                  className="text-white font-semibold h-9 px-5 text-xs rounded-lg"
                  style={{ backgroundColor: BRAND.accent }}
                  onClick={onOpenChat}
                  data-testid="button-open-metryxai"
                >
                  <MessageCircle size={14} className="mr-1" /> Start Conversation
                  <ArrowRight size={14} className="ml-1.5" />
                </Button>
                <Button 
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/10 text-xs h-9 px-5 rounded-lg"
                  onClick={() => onNavigate?.('request-demo')}
                  data-testid="btn-metryxai-demo"
                >
                  Request Demo
                </Button>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-white/55">
                {[
                  { icon: Clock, label: 'Available 24/7' },
                  { icon: Globe, label: '10+ Languages' },
                  { icon: Shield, label: 'Privacy-First' },
                  { icon: Lock, label: 'SOC2 Certified' },
                ].map((item, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <item.icon size={11} style={{ color: BRAND.accent }} /> {item.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { value: '24/7', label: 'Availability', sub: 'Always ready' },
                { value: '10+', label: 'Languages', sub: 'Including regional' },
                { value: '19', label: 'LBI Domains', sub: 'Full coverage' },
                { value: '<2s', label: 'Response Time', sub: 'Instant insights' },
              ].map((stat, idx) => (
                <div key={idx} className="bg-white/[0.07] rounded-xl px-4 py-3 text-center" data-testid={`metryxai-stat-${idx}`}>
                  <p className="text-xl font-bold text-white tracking-tight">{stat.value}</p>
                  <p className="text-xs font-semibold text-white/75 mt-0.5">{stat.label}</p>
                  <p className="text-2xs text-white/35">{stat.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100 rounded-lg border border-gray-100" data-testid="metryxai-value-strip">
        {[
          { icon: Brain, label: 'LBI-Aware', text: 'Understands all 19 domains natively' },
          { icon: Layers, label: 'Context-Driven', text: 'Based on actual assessment data' },
          { icon: Globe, label: 'Multi-Language', text: 'Hindi, Tamil, Telugu & 7 more' },
          { icon: Shield, label: 'Privacy-First', text: 'DPDP compliant, encrypted' },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-2.5 px-3 py-3" data-testid={`value-item-${i}`}>
            <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.primary}08` }}>
              <item.icon size={14} style={{ color: BRAND.primary }} />
            </div>
            <div>
              <p className="text-xs font-bold" style={{ color: BRAND.primary }}>{item.label}</p>
              <p className="text-2xs text-gray-400 leading-snug">{item.text}</p>
            </div>
          </div>
        ))}
      </div>

      <section className="py-8 px-4" style={{ backgroundColor: 'var(--bg-secondary, #f8fafc)' }} data-testid="metryxai-capabilities-section">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
            <div>
              <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.accent}20`, color: BRAND.accent }}>
                Beyond a Chatbot
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }}>
                More Than a Chatbot
              </h2>
              <p className="mt-1.5 text-sm max-w-2xl text-gray-500">
                Built on the LBI framework and educational psychology — understands your child's profile, not just questions
              </p>
            </div>
            <Button 
              className="font-medium px-5 h-9 rounded-lg text-white text-xs shrink-0"
              style={{ backgroundColor: BRAND.accent }}
              onClick={onOpenChat}
              data-testid="btn-capabilities-chat"
            >
              <MessageCircle size={14} className="mr-1" /> Try It Now
            </Button>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="metryxai-capabilities">
            {CAPABILITIES.map((cap, idx) => {
              const Icon = cap.icon;
              return (
                <Card key={cap.title} className="border-0 shadow-sm hover:shadow-md transition-all group" data-testid={`capability-${cap.title.toLowerCase().replace(/\s+/g, '-')}`}>
                  <CardContent className="p-5">
                    <div 
                      className="h-10 w-10 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                      style={{ backgroundColor: `${idx % 2 === 0 ? BRAND.primary : BRAND.accent}10` }}
                    >
                      <Icon size={20} style={{ color: idx % 2 === 0 ? BRAND.primary : BRAND.accent }} />
                    </div>
                    <h4 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary, #1e293b)' }}>{cap.title}</h4>
                    <p className="text-xs leading-relaxed text-gray-500">{cap.desc}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-8 px-4" data-testid="metryxai-chat-preview-section">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
            <div>
              <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.primary}15`, color: BRAND.primary }}>
                Live Preview
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }}>
                See How MetryxAI Responds
              </h2>
              <p className="mt-1.5 text-sm max-w-2xl text-gray-500">
                Real questions parents and students ask, with personalized, data-driven AI responses
              </p>
            </div>
            <Button 
              variant="outline"
              className="font-medium px-5 h-9 rounded-lg text-xs shrink-0"
              style={{ borderColor: BRAND.primary, color: BRAND.primary }}
              onClick={onOpenChat}
              data-testid="btn-try-chat"
            >
              <Play size={14} className="mr-1" /> Start a Chat
            </Button>
          </div>

          <div className="grid lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
              <Card className="border-0 shadow-lg h-full overflow-hidden" data-testid="metryxai-chat-mockup">
                <div className="px-4 py-2.5 flex items-center gap-2.5 border-b" style={{ backgroundColor: BRAND.primary }}>
                  <div className="h-7 w-7 rounded-full flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}30` }}>
                    <Bot size={14} style={{ color: BRAND.accent }} />
                  </div>
                  <div className="text-white">
                    <p className="text-xs font-bold">MetryxAI Assistant</p>
                    <p className="text-2xs text-white/60 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400" /> Online
                    </p>
                  </div>
                </div>
                <CardContent className="p-4 space-y-3" style={{ backgroundColor: '#fafbfc' }}>
                  <div className="flex items-start gap-2.5">
                    <div className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-white text-2xs font-bold" style={{ backgroundColor: BRAND.primary }}>
                      <User size={12} />
                    </div>
                    <div className="p-2.5 rounded-xl rounded-tl-sm text-xs max-w-[80%]" style={{ backgroundColor: `${BRAND.primary}08`, color: 'var(--text-primary, #1e293b)' }}>
                      My daughter Priya scored low on D03 (Emotional Regulation). Can you explain what this means?
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 justify-end">
                    <div className="p-2 rounded-xl rounded-tr-sm max-w-[85%] text-white" style={{ backgroundColor: BRAND.primary, fontSize: '9px', lineHeight: '1.4' }}>
                      <p className="mb-1">Hi! I've reviewed Priya's LBI assessment for D03. Here's what the subdomains reveal:</p>
                      <div className="space-y-0.5 text-white/85" style={{ fontSize: '8px' }}>
                        <p><span className="font-semibold text-white">SD03_01 Stress Reactivity:</span> 42/100</p>
                        <p><span className="font-semibold text-white">SD03_02 Cognitive Control:</span> 55/100</p>
                        <p><span className="font-semibold text-white">SD03_03 Recovery Speed:</span> 38/100</p>
                      </div>
                      <p className="mt-1" style={{ color: BRAND.accent, fontSize: '8px' }}>Would you like specific strategies for her age band (B: 11-14)?</p>
                    </div>
                    <div className="h-6 w-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.accent}25` }}>
                      <Bot size={12} style={{ color: BRAND.accent }} />
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-white text-2xs font-bold" style={{ backgroundColor: BRAND.primary }}>
                      <User size={12} />
                    </div>
                    <div className="p-2.5 rounded-xl rounded-tl-sm text-xs max-w-[80%]" style={{ backgroundColor: `${BRAND.primary}08`, color: 'var(--text-primary, #1e293b)' }}>
                      Yes please! What can I do at home to help?
                    </div>
                  </div>
                </CardContent>
                <div className="px-4 py-2.5 border-t flex items-center gap-2">
                  <div className="flex-1 h-8 rounded-lg border flex items-center px-2.5" style={{ borderColor: `${BRAND.primary}20` }}>
                    <p className="text-xs" style={{ color: 'var(--text-muted, #94a3b8)' }}>Type a message...</p>
                  </div>
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: BRAND.accent }}>
                    <Send size={14} className="text-white" />
                  </div>
                </div>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-3">
              <Card className="border-0 shadow-md" data-testid="metryxai-topics">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}15` }}>
                      <Lightbulb size={16} style={{ color: BRAND.accent }} />
                    </div>
                    <h3 className="font-bold text-sm" style={{ color: BRAND.primary }}>Popular Topics</h3>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      'LBI score interpretation',
                      'Exam preparation tips',
                      'Study schedule planning',
                      'Emotional regulation help',
                      'Domain improvement plans',
                      'Progress tracking advice',
                    ].map((topic, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-lg border hover:shadow-sm transition-all cursor-pointer group" data-testid={`topic-${idx}`}>
                        <div className="h-6 w-6 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.primary}08` }}>
                          <MessageCircle size={12} style={{ color: BRAND.primary }} />
                        </div>
                        <span className="text-xs font-medium flex-1" style={{ color: 'var(--text-primary, #1e293b)' }}>{topic}</span>
                        <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: BRAND.accent }} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md" data-testid="metryxai-quick-stats">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}10` }}>
                      <Target size={16} style={{ color: BRAND.primary }} />
                    </div>
                    <h3 className="font-bold text-sm" style={{ color: BRAND.primary }}>AI Accuracy</h3>
                  </div>
                  <div className="space-y-2.5">
                    {[
                      { label: 'LBI Interpretation', pct: 96 },
                      { label: 'Study Planning', pct: 92 },
                      { label: 'Exam Strategy', pct: 89 },
                    ].map((item, idx) => (
                      <div key={idx}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium" style={{ color: 'var(--text-primary, #1e293b)' }}>{item.label}</span>
                          <span className="font-bold" style={{ color: BRAND.accent }}>{item.pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full" style={{ backgroundColor: `${BRAND.accent}15` }}>
                          <div className="h-full rounded-full" style={{ width: `${item.pct}%`, backgroundColor: BRAND.accent }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section className="py-8 px-4" style={{ backgroundColor: 'var(--bg-secondary, #f8fafc)' }} data-testid="metryxai-conversations-section">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-6">
            <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.primary}15`, color: BRAND.primary }}>
              See It in Action
            </Badge>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }}>
              Sample Conversations
            </h2>
            <p className="mt-1.5 text-sm max-w-2xl mx-auto text-gray-500">
              Real questions parents ask, with personalized, data-driven AI responses
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-4" data-testid="metryxai-conversations">
            {SAMPLE_CONVERSATIONS.map((conv, i) => (
              <Card key={i} className="border-0 shadow-sm hover:shadow-md transition-all overflow-hidden group" data-testid={`conversation-${i}`}>
                <div className="h-1" style={{ backgroundColor: i % 2 === 0 ? BRAND.primary : BRAND.accent }} />
                <CardContent className="p-4">
                  <Badge 
                    variant="outline" 
                    className="text-2xs font-bold mb-3 px-2 py-0.5"
                    style={{ borderColor: i % 2 === 0 ? BRAND.primary : BRAND.accent, color: i % 2 === 0 ? BRAND.primary : BRAND.accent }}
                  >
                    {conv.tag}
                  </Badge>
                  <div className="flex items-start gap-2 mb-3">
                    <div 
                      className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-white text-2xs font-bold"
                      style={{ backgroundColor: BRAND.primary }}
                    >
                      <User size={13} />
                    </div>
                    <p className="text-xs font-semibold italic leading-relaxed pt-1" style={{ color: 'var(--text-primary, #1e293b)' }}>
                      {conv.q}
                    </p>
                  </div>
                  <div className="flex items-start gap-2 ml-9">
                    <div 
                      className="h-5 w-5 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${BRAND.accent}20` }}
                    >
                      <Sparkles size={10} style={{ color: BRAND.accent }} />
                    </div>
                    <p className="text-xs leading-relaxed text-gray-500">
                      {conv.a}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-8 px-4" data-testid="metryxai-use-cases-section">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-6">
            <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.accent}20`, color: BRAND.accent }}>
              For Everyone
            </Badge>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }}>
              Built For Every Stakeholder
            </h2>
            <p className="mt-1.5 text-sm max-w-2xl mx-auto text-gray-500">
              Whether you're a parent, student, or educator — MetryxAI adapts its guidance to your specific needs
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-4" data-testid="metryxai-use-cases">
            {USE_CASES.map((uc) => {
              const Icon = uc.icon;
              return (
                <Card key={uc.role} className="border-0 shadow-sm hover:shadow-md transition-all overflow-hidden group" data-testid={`use-case-${uc.role.toLowerCase()}`}>
                  <div className="h-1.5" style={{ backgroundColor: uc.color }} />
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2.5 mb-4">
                      <div 
                        className="h-10 w-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                        style={{ backgroundColor: `${uc.color}12` }}
                      >
                        <Icon size={20} style={{ color: uc.color }} />
                      </div>
                      <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary, #1e293b)' }}>{uc.role}</h3>
                    </div>
                    <div className="space-y-2">
                      {uc.items.map((item) => (
                        <div key={item} className="flex items-start gap-2">
                          <CheckCircle2 size={13} className="shrink-0 mt-0.5" style={{ color: uc.color }} />
                          <span className="text-xs leading-relaxed text-gray-500">{item}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-8 px-4" style={{ backgroundColor: 'var(--bg-secondary, #f8fafc)' }} data-testid="metryxai-how-section">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-6">
            <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.accent}20`, color: BRAND.accent }}>
              Simple Process
            </Badge>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }}>
              How It Works
            </h2>
            <p className="mt-1.5 text-sm max-w-2xl mx-auto text-gray-500">
              From question to actionable insight in three simple steps
            </p>
          </div>

          <div className="relative">
            <div className="hidden md:block absolute top-10 left-[16%] right-[16%] h-0.5" style={{ backgroundColor: `${BRAND.accent}25` }} />
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { step: '1', title: 'Ask a Question', desc: 'Type any question about your child\'s LBI scores, exam prep, or behavioral patterns.', icon: MessageCircle },
                { step: '2', title: 'AI Analyzes Context', desc: 'MetryxAI pulls from your child\'s LBI profile and behavioral data for a personalized response.', icon: Brain },
                { step: '3', title: 'Get Guidance', desc: 'Receive actionable advice, domain-specific strategies, and step-by-step plans.', icon: Lightbulb },
              ].map((step) => (
                <div key={step.step} className="relative text-center" data-testid={`how-step-${step.step}`}>
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-3 text-white font-bold text-xs relative z-10"
                    style={{ backgroundColor: BRAND.primary }}
                  >
                    {step.step}
                  </div>
                  <Card className="border-0 shadow-sm hover:shadow-md transition-all group">
                    <CardContent className="p-5 text-center">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3 transition-transform group-hover:scale-110"
                        style={{ backgroundColor: `${BRAND.accent}12` }}
                      >
                        <step.icon size={20} style={{ color: BRAND.accent }} />
                      </div>
                      <h4 className="text-sm font-bold mb-1.5" style={{ color: 'var(--text-primary, #1e293b)' }}>{step.title}</h4>
                      <p className="text-xs leading-relaxed text-gray-500">{step.desc}</p>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-8 px-4 rounded-xl" style={{ backgroundColor: BRAND.primary }} data-testid="metryxai-cta">
        <div className="max-w-4xl mx-auto text-center">
          <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center mx-auto mb-4">
            <MessageCircle size={20} className="text-white" />
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white mb-2 tracking-tight">
            Ready to Talk to <span style={{ color: BRAND.accent }}>MetryxAI?</span>
          </h2>
          <p className="text-white/60 text-xs mb-5 max-w-lg mx-auto leading-relaxed">
            Start a conversation and experience personalized, data-driven education guidance 
            powered by the LBI framework — available 24/7 in 10+ languages.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mb-4">
            <Button 
              className="h-9 px-5 font-semibold text-xs rounded-lg text-white"
              style={{ backgroundColor: BRAND.accent }}
              onClick={onOpenChat}
              data-testid="button-open-metryxai-bottom"
            >
              <MessageCircle size={14} className="mr-1" /> Start Conversation
              <ArrowRight size={14} className="ml-1.5" />
            </Button>
            <Button 
              variant="outline"
              className="h-9 px-5 font-medium text-xs border-white/30 text-white hover:bg-white/10 rounded-lg"
              onClick={() => onNavigate?.('request-demo')}
            >
              Request a Demo
            </Button>
          </div>
          <div className="flex flex-wrap justify-center gap-5 text-white/50 text-xs" data-testid="cta-trust-badges">
            <span className="flex items-center gap-1.5" data-testid="cta-trust-instant"><Zap size={12} /> Instant responses</span>
            <span className="flex items-center gap-1.5" data-testid="cta-trust-privacy"><Shield size={12} /> 100% privacy compliant</span>
            <span className="flex items-center gap-1.5" data-testid="cta-trust-free"><CheckCircle2 size={12} /> No credit card required</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function InstituteDashboard({ onOpenChat, onNavigate }: { onOpenChat?: () => void; onNavigate?: (screen: string) => void }) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Welcome back! I\'m your MetryxAI Assistant. I can help you analyze LBI batch results, identify at-risk students, generate parent reports, and plan classroom interventions. What would you like to explore today?', timestamp: new Date() },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'history'>('chat');
  const [searchQuery, setSearchQuery] = useState('');

  const handleSendMessage = () => {
    if (!inputValue.trim() || isTyping) return;
    const userMsg: ChatMessage = { role: 'user', content: inputValue.trim(), timestamp: new Date() };
    setChatMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    setTimeout(() => {
      const responses: Record<string, string> = {
        'batch': 'Based on the latest LBI assessment for your institution:\n\n**Batch Summary (Class 8A - 42 students)**\n- Average LBI Score: 67.3/100\n- Top Performing Domain: D01 (Academic Effectiveness) - 74.2\n- Weakest Domain: D03 (Emotional Regulation) - 52.8\n- At-Risk Students (below 40): 6 students flagged\n\n**Key Insights:**\n1. D03 and D09 (Stress Management) show correlated low scores in 68% of students\n2. Age Band B (11-14) shows 12% lower scores than Band A in social competence\n3. 4 students need immediate intervention for D05 (Social Competence)\n\nWould you like me to generate detailed intervention plans for the flagged students?',
        'at-risk': 'I\'ve identified **6 students** in Class 10 showing declining LBI scores:\n\n1. **Priya S.** - D03 dropped from 58 to 41 (-17 pts)\n2. **Rahul K.** - D07 dropped from 65 to 48 (-17 pts)\n3. **Meera T.** - D05 dropped from 52 to 38 (-14 pts)\n4. **Arjun D.** - D09 dropped from 61 to 49 (-12 pts)\n5. **Sneha P.** - D01 dropped from 70 to 59 (-11 pts)\n6. **Vikram R.** - D03 dropped from 55 to 45 (-10 pts)\n\n**Common Pattern:** 4 of 6 students show emotional regulation decline coinciding with board exam preparation stress.\n\n**Recommended Actions:**\n- Schedule counselor sessions for Priya S. and Meera T. (priority)\n- Group intervention workshop for stress management\n- Parent notification for all 6 students\n\nShall I draft the parent communication?',
        'parent': 'Here\'s a draft parent communication summary for Class 7:\n\n**Subject: LBI Assessment Insights - Your Child\'s Behavioral Profile**\n\nDear Parents,\n\nWe recently completed the Learning Behavior Index assessment for Class 7. Here are the key highlights:\n\n**Class Overview:**\n- 38 students assessed across 19 behavioral domains\n- Class average: 69.1/100 (Above platform benchmark of 65.2)\n- Strongest areas: Academic Effectiveness, Discipline & Habits\n- Areas for growth: Emotional Regulation, Creative Thinking\n\n**What This Means:**\nYour child\'s individual report provides specific insights into their learning behavior patterns. The report identifies strengths to build upon and areas where targeted support can make a significant difference.\n\n**Next Steps:**\n- Individual reports will be shared via the parent portal\n- Parent-teacher meetings scheduled for Feb 15-20\n- Optional: Book a MetryxAI consultation for personalized guidance\n\nShall I customize this for individual students or add specific domain details?',
        'intervention': 'Here are recommended interventions for students scoring below 40 on D05 (Social Competence) in Age Band B:\n\n**Group Activities (4 sessions/week):**\n1. **Collaborative Problem Solving** - Teams of 4, rotating roles, structured discussions on age-appropriate scenarios\n2. **Peer Mentoring Circles** - Pair high-D05 with low-D05 students for guided peer support\n3. **Role-Play Workshops** - Practice conflict resolution and perspective-taking in safe environments\n4. **Team Projects** - Cross-class projects requiring communication and negotiation skills\n\n**Individual Exercises (daily):**\n1. **Social Reflection Journal** - 5-minute daily entries on social interactions and feelings\n2. **Empathy Building Tasks** - Weekly perspective-taking activities with guided reflection\n\n**Teacher Guidelines:**\n- Monitor progress bi-weekly using subdomain scores (SD05_01 to SD05_05)\n- Provide positive reinforcement for collaborative behaviors\n- Avoid public comparisons or competitive framing\n\n**Expected Timeline:** 6-8 weeks for measurable improvement in subdomain scores.\n\nWant me to create a detailed implementation calendar?',
      };

      let response = 'I\'ve analyzed your query. Based on your institution\'s LBI data, here are the key findings:\n\n';
      const lowerInput = userMsg.content.toLowerCase();
      if (lowerInput.includes('batch') || lowerInput.includes('class 8') || lowerInput.includes('analyze')) {
        response = responses['batch'];
      } else if (lowerInput.includes('risk') || lowerInput.includes('declining') || lowerInput.includes('class 10')) {
        response = responses['at-risk'];
      } else if (lowerInput.includes('parent') || lowerInput.includes('communication') || lowerInput.includes('summary') || lowerInput.includes('class 7')) {
        response = responses['parent'];
      } else if (lowerInput.includes('intervention') || lowerInput.includes('d05') || lowerInput.includes('social')) {
        response = responses['intervention'];
      } else {
        response += '**Institution Overview:**\n- Total Students Assessed: 847\n- Average LBI Score: 68.4/100\n- Completion Rate: 94.2%\n- Domains Needing Attention: D03, D05, D09\n\nI can provide deeper analysis on any specific class, batch, domain, or student. What would you like to explore?\n\n**Quick suggestions:**\n- "Analyze Class 8A batch results"\n- "Show at-risk students in Class 10"\n- "Generate parent report for Class 7"\n- "Plan interventions for D05"';
      }

      setChatMessages(prev => [...prev, { role: 'assistant', content: response, timestamp: new Date() }]);
      setIsTyping(false);
    }, 1500);
  };

  const handleQuickPrompt = (prompt: string) => {
    setInputValue(prompt);
    setActiveTab('chat');
  };

  const filteredHistory = RECENT_CONVERSATIONS.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.preview.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="py-10 px-4" data-testid="metryxai-institute-dashboard">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}15` }}>
                <Bot size={22} style={{ color: BRAND.accent }} />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }} data-testid="text-institute-welcome">
                  MetryxAI Assistant
                </h1>
                <p className="text-xs text-muted-foreground">Welcome back, Institute</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="text-xs font-semibold px-3 py-1.5 flex items-center gap-1.5" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }} data-testid="badge-ai-online">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
              AI Online
            </Badge>
            <Badge variant="outline" className="text-xs font-semibold px-3 py-1.5" data-testid="badge-queries-today">
              <MessageCircle size={12} className="mr-1" /> 24 queries today
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Users, value: '847', label: 'Students Assessed', change: '+32 this week', color: BRAND.primary },
            { icon: MessageCircle, value: '1,284', label: 'AI Conversations', change: '+156 this month', color: BRAND.accent },
            { icon: Brain, value: '68.4', label: 'Avg LBI Score', change: '+2.1 from last cycle', color: BRAND.primary },
            { icon: AlertTriangle, value: '23', label: 'At-Risk Flagged', change: '-4 from last week', color: BRAND.danger },
          ].map((stat, idx) => (
            <Card key={idx} className="border shadow-sm" data-testid={`inst-stat-${idx}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${stat.color}12` }}>
                    <stat.icon size={18} style={{ color: stat.color }} />
                  </div>
                  <ArrowUpRight size={14} className="text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold tracking-tight" style={{ color: BRAND.primary }}>{stat.value}</p>
                <p className="text-xs font-medium text-muted-foreground mt-0.5">{stat.label}</p>
                <p className="text-2xs mt-1" style={{ color: BRAND.accent }}>{stat.change}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">

          <div className="lg:col-span-2">
            <Card className="border shadow-sm h-full flex flex-col" data-testid="inst-chat-panel">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('chat')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === 'chat' ? 'text-white' : ''}`}
                    style={activeTab === 'chat' ? { backgroundColor: BRAND.primary } : { color: BRAND.primary }}
                    data-testid="tab-chat"
                  >
                    <MessageCircle size={12} className="inline mr-1.5" /> Chat
                  </button>
                  <button
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === 'history' ? 'text-white' : ''}`}
                    style={activeTab === 'history' ? { backgroundColor: BRAND.primary } : { color: BRAND.primary }}
                    data-testid="tab-history"
                  >
                    <History size={12} className="inline mr-1.5" /> History
                  </button>
                </div>
                <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                  MetryxAI Engine v2.1
                </div>
              </div>

              {activeTab === 'chat' ? (
                <>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[480px] min-h-[400px]" data-testid="inst-chat-messages">
                    {chatMessages.map((msg, idx) => (
                      <div key={idx} className={`flex items-start gap-3 ${msg.role === 'user' ? '' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                          <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.accent}20` }}>
                            <Bot size={14} style={{ color: BRAND.accent }} />
                          </div>
                        )}
                        <div
                          className={`p-3 rounded-xl text-sm max-w-[85%] whitespace-pre-wrap leading-relaxed ${
                            msg.role === 'user'
                              ? 'ml-auto rounded-tr-sm text-white'
                              : 'rounded-tl-sm'
                          }`}
                          style={
                            msg.role === 'user'
                              ? { backgroundColor: BRAND.primary }
                              : { backgroundColor: `${BRAND.primary}06`, color: 'var(--text-primary, #1e293b)' }
                          }
                          data-testid={`chat-msg-${idx}`}
                        >
                          {msg.content}
                        </div>
                        {msg.role === 'user' && (
                          <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-white text-2xs font-bold" style={{ backgroundColor: BRAND.primary }}>
                            <User size={14} />
                          </div>
                        )}
                      </div>
                    ))}
                    {isTyping && (
                      <div className="flex items-start gap-3">
                        <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.accent}20` }}>
                          <Bot size={14} style={{ color: BRAND.accent }} />
                        </div>
                        <div className="p-3 rounded-xl rounded-tl-sm text-sm flex items-center gap-2" style={{ backgroundColor: `${BRAND.primary}06` }}>
                          <Loader2 size={14} className="animate-spin" style={{ color: BRAND.accent }} />
                          <span className="text-xs text-muted-foreground">MetryxAI is analyzing...</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="px-4 py-3 border-t">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Ask about LBI data, student performance, batch analysis..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(); }}
                        className="text-sm h-10"
                        disabled={isTyping}
                        data-testid="input-inst-chat"
                      />
                      <Button
                        size="sm"
                        className="h-10 px-4 text-white shrink-0"
                        style={{ backgroundColor: BRAND.accent }}
                        onClick={handleSendMessage}
                        disabled={!inputValue.trim() || isTyping}
                        data-testid="btn-inst-send"
                      >
                        <Send size={14} />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[540px] min-h-[400px]" data-testid="inst-conversation-history">
                  <div className="relative mb-3">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search conversations..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 text-xs h-9"
                      data-testid="input-search-history"
                    />
                  </div>
                  {filteredHistory.map((conv) => (
                    <div
                      key={conv.id}
                      className="p-3 rounded-xl border hover:shadow-sm transition-all cursor-pointer group"
                      data-testid={`history-item-${conv.id}`}
                      onClick={() => setActiveTab('chat')}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          {conv.starred && <Star size={12} className="shrink-0" style={{ color: BRAND.warning, fill: BRAND.warning }} />}
                          <p className="text-sm font-semibold truncate" style={{ color: BRAND.primary }}>{conv.title}</p>
                        </div>
                        <span className="text-2xs text-muted-foreground shrink-0">{conv.time}</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5">{conv.preview}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-2xs px-1.5 py-0">
                          <MessageCircle size={10} className="mr-0.5" /> {conv.messages} msgs
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border shadow-sm" data-testid="inst-quick-prompts">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}15` }}>
                    <Zap size={16} style={{ color: BRAND.accent }} />
                  </div>
                  <h3 className="text-sm font-bold" style={{ color: BRAND.primary }}>Quick Actions</h3>
                </div>
                <div className="space-y-2">
                  {INSTITUTE_QUICK_PROMPTS.map((prompt, idx) => {
                    const Icon = prompt.icon;
                    return (
                      <button
                        key={idx}
                        className="w-full flex items-center gap-3 p-2.5 rounded-lg border hover:shadow-sm transition-all text-left group"
                        onClick={() => handleQuickPrompt(prompt.prompt)}
                        data-testid={`quick-prompt-${idx}`}
                      >
                        <div className="h-7 w-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.primary}08` }}>
                          <Icon size={14} style={{ color: BRAND.primary }} />
                        </div>
                        <span className="text-xs font-medium flex-1" style={{ color: 'var(--text-primary, #1e293b)' }}>{prompt.label}</span>
                        <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: BRAND.accent }} />
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm" data-testid="inst-ai-usage">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}10` }}>
                    <BarChart3 size={16} style={{ color: BRAND.primary }} />
                  </div>
                  <h3 className="text-sm font-bold" style={{ color: BRAND.primary }}>AI Usage This Month</h3>
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'LBI Analysis', count: 412, pct: 82 },
                    { label: 'Parent Reports', count: 186, pct: 58 },
                    { label: 'Interventions', count: 97, pct: 35 },
                    { label: 'At-Risk Alerts', count: 64, pct: 24 },
                  ].map((item, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium" style={{ color: 'var(--text-primary, #1e293b)' }}>{item.label}</span>
                        <span className="font-semibold" style={{ color: BRAND.accent }}>{item.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ backgroundColor: `${BRAND.accent}15` }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${item.pct}%`, backgroundColor: BRAND.accent }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t flex items-center justify-between">
                  <span className="text-2xs text-muted-foreground">Total: 759 queries</span>
                  <span className="text-2xs font-semibold" style={{ color: BRAND.accent }}>Unlimited plan</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm" data-testid="inst-ai-capabilities">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}15` }}>
                    <Sparkles size={16} style={{ color: BRAND.accent }} />
                  </div>
                  <h3 className="text-sm font-bold" style={{ color: BRAND.primary }}>AI Can Help With</h3>
                </div>
                <div className="space-y-1.5">
                  {[
                    'Batch LBI score analysis',
                    'At-risk student identification',
                    'Parent report generation',
                    'Classroom intervention plans',
                    'Domain trend analysis',
                    'Benchmark comparisons',
                    'Cohort behavior patterns',
                    'Individual student deep-dive',
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs" data-testid={`capability-item-${idx}`}>
                      <CheckCircle2 size={12} style={{ color: BRAND.accent }} />
                      <span style={{ color: 'var(--text-secondary, #64748b)' }}>{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

      </div>
    </div>
  );
}
