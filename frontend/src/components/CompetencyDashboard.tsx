import { BRAND_NAVY as BRAND } from '@/design-system/tokens';
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Brain, Target, BarChart3, TrendingUp, Lightbulb, User,
  ArrowLeft, RefreshCw, ChevronDown, ChevronUp, Award,
  AlertTriangle, CheckCircle, XCircle, Clock, ArrowRight,
  BookOpen, Briefcase, Users, Star, Zap, Activity, Shield,
  GraduationCap, MessageSquare, ExternalLink, Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useToast } from '@/hooks/use-toast';
import { Screen } from '../App';
import { AppTopBar } from './AppTopBar';
import { GlobalSearch } from './GlobalSearch';
import { QuickTour } from './QuickTour';
import { Footer } from './layout/Footer';
import { IntelligenceLayers } from './shared/IntelligenceLayers';



interface CompetencyScore {
  competencyId: string;
  competencyCode: string;
  competencyName: string;
  rawScore: number;
  confidence: number;
  finalScore: number;
  weightedScore: number;
}

interface DomainScore {
  domainCode: string;
  domainName: string;
  avgScore: number;
  competencies: CompetencyScore[];
}

interface PercentileRow {
  competencyId: string;
  competencyCode: string;
  competencyName: string;
  domainName: string;
  userScore: number;
  percentile: number;
  vsMedian: number;
  vsMean: number;
  benchmarkMean: number;
  p75: number;
}

interface GapRow {
  competencyId: string;
  competencyCode: string;
  competencyName: string;
  domainName: string;
  userScore: number;
  targetScore: number;
  gap: number;
  weightedGap: number;
  gapLevel: string;
  priority: number;
}

interface RoleFitFactor {
  label: string;
  score: number;
  weight: number;
}

interface InterventionItem {
  id: string;
  type: string;
  title: string;
  description: string;
  gap_level: string;
  competency_name: string;
  provider?: string;
  duration_weeks?: number;
}

const API = (path: string) => `/api/competency${path}`;

const apiFetch = async (url: string, options?: RequestInit) => {
  const token = localStorage.getItem('metryx_token');
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options?.headers },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

function ScoreBar({ score, max = 100, color = BRAND.primary, showLabel = true, height = 8 }: { score: number; max?: number; color?: string; showLabel?: boolean; height?: number }) {
  const pct = Math.min(Math.round((score / max) * 100), 100);
  const barColor = score >= 75 ? '#4ECDC4' : score >= 55 ? BRAND.accent : score >= 35 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 rounded-full bg-gray-100 overflow-hidden" style={{ height }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
      {showLabel && <span className="text-xs font-semibold w-8 text-right" style={{ color: barColor }}>{score}</span>}
    </div>
  );
}

function GapBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    low: 'bg-blue-100 text-blue-700 border-blue-200',
    strength: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${styles[level] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}

function ReadinessBadge({ level }: { level: string }) {
  if (level === 'Ready Now') return <span className="px-3 py-1 rounded-full text-sm font-semibold bg-emerald-100 text-emerald-700">{level}</span>;
  if (level === 'Ready in 3-6 Months') return <span className="px-3 py-1 rounded-full text-sm font-semibold bg-[rgba(27,107,154,0.10)] text-[#1B6B9A]">{level}</span>;
  if (level === 'Ready in 6-12 Months') return <span className="px-3 py-1 rounded-full text-sm font-semibold bg-amber-100 text-amber-700">{level}</span>;
  return <span className="px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-700">{level}</span>;
}

function InterventionTypeIcon({ type }: { type: string }) {
  if (type === 'course') return <BookOpen className="h-4 w-4 text-blue-500" />;
  if (type === 'project') return <Briefcase className="h-4 w-4 text-[#0B3C5D]" />;
  return <Users className="h-4 w-4 text-emerald-500" />;
}

export default function CompetencyDashboard({ onNavigate }: { onNavigate?: (screen: Screen) => void }) {
  const [activeTab, setActiveTab] = useState<'profile' | 'scores' | 'benchmark' | 'gap' | 'rolefit' | 'reco' | 'intelligence'>('profile');
  const [userId, setUserId] = useState<string>('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    apiFetch('/api/user')
      .then((data: any) => {
        const u = data?.user ?? data;
        if (u?.id) setUserId(u.id);
      })
      .catch(() => {});
  }, []);

  const TABS = [
    { id: 'profile',    label: 'Profile',         icon: User },
    { id: 'scores',     label: 'Competency Scores',icon: BarChart3 },
    { id: 'benchmark',  label: 'Benchmark',        icon: Activity },
    { id: 'gap',        label: 'Gap Analysis',     icon: Target },
    { id: 'rolefit',    label: 'Role Fit',         icon: Award },
    { id: 'reco',       label: 'Recommendations',  icon: Lightbulb },
    { id: 'intelligence', label: 'Intelligence',   icon: Brain },
  ] as const;

  const profileQuery = useQuery({
    queryKey: ['comp-profile', userId],
    queryFn: () => apiFetch(API(`/profile/${userId}`)),
    enabled: !!userId,
  });

  const scoresQuery = useQuery({
    queryKey: ['comp-scores', userId],
    queryFn: () => apiFetch(API(`/compute-score/${userId}`)),
    enabled: !!userId && activeTab === 'scores',
  });

  const benchmarkQuery = useQuery({
    queryKey: ['comp-benchmark', userId],
    queryFn: () => apiFetch(API(`/get-percentile/${userId}`)),
    enabled: !!userId && activeTab === 'benchmark',
  });

  const gapQuery = useQuery({
    queryKey: ['comp-gap', userId],
    queryFn: () => apiFetch(API(`/gap-analysis/${userId}`)),
    enabled: !!userId && activeTab === 'gap',
  });

  const roleFitQuery = useQuery({
    queryKey: ['comp-rolefit', userId],
    queryFn: () => apiFetch(API(`/role-fit/${userId}`)),
    enabled: !!userId && activeTab === 'rolefit',
  });

  const recoQuery = useQuery({
    queryKey: ['comp-reco', userId],
    queryFn: () => apiFetch(API(`/interventions/${userId}`)),
    enabled: !!userId && activeTab === 'reco',
  });

  // Role library: resolves the user's target role to the bigger O*NET-backed
  // competency library so roles outside the legacy hardcoded set still surface
  // their required competencies. Read-only and honest — an unresolved role or a
  // role with no ratings returns a `note` rather than fabricated requirements.
  const roleLibQuery = useQuery({
    queryKey: ['comp-role-library', userId],
    queryFn: () => apiFetch(API(`/role-library/${userId}`)),
    enabled: !!userId,
  });
  const roleLib = roleLibQuery.data?.data;

  const [profileForm, setProfileForm] = useState({ currentRole: '', targetRole: '', industry: '', careerStage: '', experienceYears: 0 });
  const [editingProfile, setEditingProfile] = useState(false);

  useEffect(() => {
    if (profileQuery.data && !editingProfile) {
      setProfileForm({
        currentRole: profileQuery.data.current_job_role ?? '',
        targetRole: profileQuery.data.target_job_role ?? '',
        industry: profileQuery.data.industry ?? '',
        careerStage: profileQuery.data.career_stage ?? 'mid',
        experienceYears: profileQuery.data.experience_years ?? 0,
      });
    }
  }, [profileQuery.data, editingProfile]);

  const saveProfileMutation = useMutation({
    mutationFn: () => apiFetch(API(`/profile/${userId}`), {
      method: 'POST',
      body: JSON.stringify(profileForm),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comp-profile', userId] });
      qc.invalidateQueries({ queryKey: ['comp-scores', userId] });
      qc.invalidateQueries({ queryKey: ['comp-gap', userId] });
      qc.invalidateQueries({ queryKey: ['comp-rolefit', userId] });
      setEditingProfile(false);
      toast({ title: 'Profile saved' });
    },
    onError: () => toast({ title: 'Failed to save', variant: 'destructive' }),
  });

  const ROLES = ['Software Engineer', 'Product Manager', 'Data Analyst', 'Team Lead', 'Director', 'Consultant'];
  const STAGES = ['junior', 'mid', 'senior', 'lead'];
  const INDUSTRIES = ['Technology', 'Finance', 'Healthcare', 'Education', 'Manufacturing', 'Consulting', 'E-Commerce'];

  const [demoModule, setDemoModule] = useState<'gap' | 'benchmark' | 'hiring' | 'growth'>('gap');
  const [demoBenchIndustry, setDemoBenchIndustry] = useState<'Technology' | 'Finance' | 'Healthcare'>('Technology');

  const DEMO_GAP = [
    { name: 'Strategic Thinking', score: 52, target: 75, gap: 23, level: 'high' },
    { name: 'Data Literacy', score: 81, target: 75, gap: 0, level: 'strength' },
    { name: 'Stakeholder Mgmt', score: 44, target: 72, gap: 28, level: 'critical' },
    { name: 'Communication', score: 71, target: 75, gap: 4, level: 'low' },
    { name: 'People Leadership', score: 38, target: 70, gap: 32, level: 'critical' },
  ];

  const DEMO_BENCH: Record<string, { name: string; user: number; p25: number; p75: number }[]> = {
    Technology: [
      { name: 'Problem Solving', user: 74, p25: 55, p75: 82 },
      { name: 'Technical Depth', user: 84, p25: 62, p75: 88 },
      { name: 'Communication', user: 58, p25: 48, p75: 72 },
      { name: 'Leadership', user: 41, p25: 38, p75: 67 },
    ],
    Finance: [
      { name: 'Analytical Thinking', user: 81, p25: 67, p75: 90 },
      { name: 'Risk Management', user: 63, p25: 58, p75: 80 },
      { name: 'Stakeholder Mgmt', user: 55, p25: 50, p75: 78 },
      { name: 'Communication', user: 70, p25: 54, p75: 76 },
    ],
    Healthcare: [
      { name: 'Clinical Judgement', user: 78, p25: 65, p75: 85 },
      { name: 'Patient Communication', user: 82, p25: 60, p75: 88 },
      { name: 'Data Interpretation', user: 61, p25: 52, p75: 77 },
      { name: 'Collaboration', user: 74, p25: 55, p75: 80 },
    ],
  };

  const DEMO_HIRING = [
    { name: 'Lena W.', role: 'Senior PM', fit: 91, stage: 'Senior', risk: 'Low' },
    { name: 'Marcus T.', role: 'Mid PM', fit: 67, stage: 'Mid', risk: 'Medium' },
    { name: 'Priya S.', role: 'Lead PM', fit: 84, stage: 'Lead', risk: 'Low' },
    { name: 'Jordan K.', role: 'Junior PM', fit: 43, stage: 'Junior', risk: 'High' },
  ];

  const DEMO_GROWTH = [
    { domain: 'Strategy', now: 52, m3: 62, m6: 74 },
    { domain: 'Leadership', now: 38, m3: 50, m6: 63 },
    { domain: 'Communication', now: 71, m3: 76, m6: 80 },
    { domain: 'Data Literacy', now: 81, m3: 84, m6: 87 },
  ];

  if (!userId) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Navbar onNavigate={onNavigate!} currentScreen="competency-intelligence" />

        <main className="flex-1 pt-16">

          {/* ── Hero ── */}
          <div className="border-b border-gray-100 bg-gray-50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">

                {/* Left */}
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border mb-4" style={{ borderColor: BRAND.primary, color: BRAND.primary, backgroundColor: `${BRAND.primary}08` }}>
                    <Zap className="h-3 w-3" /> Competency Intelligence Platform™
                  </span>
                  <h1 className="text-3xl sm:text-4xl font-extrabold mb-3 leading-tight" style={{ color: BRAND.primary }}>
                    The only engine that benchmarks 50 competencies across 7 industries
                  </h1>
                  <p className="text-gray-500 text-sm leading-relaxed mb-5">
                    Delivering gap scores, role-fit probability, hiring predictions, and growth simulations in real time — for individuals, teams, and enterprises.
                  </p>

                  <div className="grid grid-cols-2 gap-3 mb-5">
                    {[
                      { value: '50', label: 'Competencies tracked', sub: 'Across 10 domains' },
                      { value: '7', label: 'Industries covered', sub: 'Tech · Finance · Healthcare +4' },
                      { value: '4', label: 'Career stages', sub: 'Junior → Lead/Principal' },
                      { value: '93%', label: 'Predictive accuracy', sub: 'Hiring outcome correlation' },
                    ].map(s => (
                      <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-3">
                        <div className="text-xl font-extrabold" style={{ color: BRAND.primary }}>{s.value}</div>
                        <div className="text-xs font-semibold text-gray-600 mt-0.5">{s.label}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{s.sub}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-3 mb-4">
                    <Button onClick={() => onNavigate?.('registration')} style={{ backgroundColor: BRAND.primary }} className="text-white px-6 font-semibold">
                      Start Free Assessment <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                    </Button>
                    <Button variant="outline" onClick={() => onNavigate?.('request-demo')} className="px-5">
                      Request Enterprise Demo
                    </Button>
                  </div>
                  <p className="text-[10px] text-gray-400 flex items-center gap-1">
                    <Shield className="h-3 w-3" /> SOC 2 Type II · GDPR compliant · No credit card required
                  </p>
                </div>

                {/* Right — live tabbed platform preview */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                    <p className="text-xs font-semibold" style={{ color: BRAND.primary }}>Platform Preview</p>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-red-400" />
                      <div className="w-2 h-2 rounded-full bg-yellow-400" />
                      <div className="w-2 h-2 rounded-full bg-teal-400" />
                    </div>
                  </div>

                  {/* Module tabs */}
                  <div className="flex border-b border-gray-100 bg-gray-50">
                    {([
                      { id: 'gap', label: 'Gap Analysis', icon: Target },
                      { id: 'benchmark', label: 'Benchmarks', icon: Activity },
                      { id: 'hiring', label: 'Hiring Pred.', icon: Award },
                      { id: 'growth', label: 'Growth Sim.', icon: TrendingUp },
                    ] as const).map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        onClick={() => setDemoModule(id)}
                        className={`flex-1 flex items-center justify-center gap-1 py-2 text-[10px] font-semibold border-b-2 transition-colors ${demoModule === id ? 'border-current bg-white' : 'border-transparent text-gray-400'}`}
                        style={demoModule === id ? { color: BRAND.primary, borderColor: BRAND.primary } : {}}
                      >
                        <Icon className="h-3 w-3" /> <span className="hidden sm:inline">{label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="p-4 min-h-[270px]">
                    {demoModule === 'gap' && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Competency gap report · Senior PM</p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-semibold border border-red-100">3 critical gaps</span>
                        </div>
                        <div className="space-y-2.5">
                          {DEMO_GAP.map(g => {
                            const barColor = g.level === 'strength' ? '#4ECDC4' : g.level === 'low' ? BRAND.accent : g.level === 'medium' ? '#f59e0b' : '#ef4444';
                            const badgeStyle: Record<string, string> = { critical: 'bg-red-50 text-red-600 border-red-100', high: 'bg-orange-50 text-orange-600 border-orange-100', low: 'bg-blue-50 text-blue-600 border-blue-100', strength: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
                            return (
                              <div key={g.name}>
                                <div className="flex items-center justify-between text-[10px] mb-1">
                                  <span className="font-medium text-gray-700">{g.name}</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className={`px-1.5 py-px rounded-full border font-semibold ${badgeStyle[g.level] ?? ''}`}>{g.level}</span>
                                    <span className="text-gray-400">{g.score} / {g.target}</span>
                                  </div>
                                </div>
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden relative">
                                  <div className="h-full rounded-full" style={{ width: `${g.score}%`, backgroundColor: barColor }} />
                                  <div className="absolute top-0 h-full w-px bg-gray-400 opacity-40" style={{ left: `${g.target}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-[9px] text-gray-400 mt-3 flex items-center gap-1"><Activity className="h-2.5 w-2.5" /> Benchmarked vs. P75 Senior cohort · Technology industry</p>
                      </div>
                    )}

                    {demoModule === 'benchmark' && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Industry percentile comparison</p>
                          <div className="flex gap-1">
                            {(['Technology', 'Finance', 'Healthcare'] as const).map(ind => (
                              <button key={ind} onClick={() => setDemoBenchIndustry(ind)}
                                className={`text-[9px] px-2 py-0.5 rounded-full border font-semibold transition-colors ${demoBenchIndustry === ind ? 'text-white border-current' : 'text-gray-400 border-gray-200'}`}
                                style={demoBenchIndustry === ind ? { backgroundColor: BRAND.primary, borderColor: BRAND.primary } : {}}
                              >{ind}</button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-3">
                          {DEMO_BENCH[demoBenchIndustry].map(row => (
                            <div key={row.name}>
                              <div className="flex items-center justify-between text-[10px] mb-1">
                                <span className="font-medium text-gray-700">{row.name}</span>
                                <span className="text-gray-400">You: <span className="font-bold" style={{ color: BRAND.primary }}>{row.user}</span> · P75: {row.p75}</span>
                              </div>
                              <div className="h-3 bg-gray-100 rounded-full overflow-hidden relative">
                                <div className="h-full rounded-l-full bg-gray-200" style={{ width: `${row.p25}%` }} />
                                <div className="absolute top-0 h-full rounded-full" style={{ left: `${row.p25}%`, width: `${row.p75 - row.p25}%`, backgroundColor: `${BRAND.accent}40` }} />
                                <div className="absolute top-0 h-full w-1.5 rounded-full bg-white border" style={{ left: `calc(${row.user}% - 3px)`, borderColor: BRAND.primary }} />
                              </div>
                              <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                                <span>P25: {row.p25}</span><span className="text-[9px]" style={{ color: BRAND.accent }}>Interquartile range</span><span>P75: {row.p75}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {demoModule === 'hiring' && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Candidate fit predictions · PM role</p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-semibold border border-blue-100">4 candidates</span>
                        </div>
                        <div className="space-y-2">
                          {DEMO_HIRING.map(c => {
                            const fitColor = c.fit >= 80 ? '#4ECDC4' : c.fit >= 60 ? BRAND.accent : '#f59e0b';
                            const riskStyle = { Low: 'bg-emerald-50 text-emerald-600 border-emerald-100', Medium: 'bg-yellow-50 text-yellow-600 border-yellow-100', High: 'bg-red-50 text-red-600 border-red-100' }[c.risk];
                            return (
                              <div key={c.name} className="flex items-center gap-3 p-2 rounded-lg border border-gray-100">
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ backgroundColor: fitColor }}>
                                  {c.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-semibold text-gray-800">{c.name}</p>
                                  <p className="text-[9px] text-gray-400">{c.role} · {c.stage}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="text-sm font-extrabold" style={{ color: fitColor }}>{c.fit}%</p>
                                  <p className="text-[9px] text-gray-400">role fit</p>
                                </div>
                                <span className={`text-[9px] px-1.5 py-px rounded-full border font-semibold ${riskStyle}`}>{c.risk}</span>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-[9px] text-gray-400 mt-3 flex items-center gap-1"><Shield className="h-2.5 w-2.5" /> Risk = attrition + underperformance probability</p>
                      </div>
                    )}

                    {demoModule === 'growth' && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">6-month growth simulation</p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(11,60,93,0.08)] text-[#0B3C5D] font-semibold border border-[rgba(11,60,93,0.20)]">+18 pts avg</span>
                        </div>
                        <div className="space-y-3">
                          {DEMO_GROWTH.map(g => (
                            <div key={g.domain}>
                              <div className="flex items-center justify-between text-[10px] mb-1">
                                <span className="font-medium text-gray-700">{g.domain}</span>
                                <span className="text-gray-400">Now <b style={{ color: BRAND.primary }}>{g.now}</b> → M3 {g.m3} → M6 <b className="text-emerald-600">{g.m6}</b></span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden relative flex">
                                <div className="h-full rounded-l-full" style={{ width: `${g.now}%`, backgroundColor: `${BRAND.primary}70` }} />
                                <div className="h-full" style={{ width: `${g.m3 - g.now}%`, backgroundColor: `${BRAND.accent}80` }} />
                                <div className="h-full rounded-r-full" style={{ width: `${g.m6 - g.m3}%`, backgroundColor: '#4ECDC4' }} />
                              </div>
                              <div className="flex gap-3 text-[9px] text-gray-400 mt-0.5">
                                <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: `${BRAND.primary}70` }} /> Current</span>
                                <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: `${BRAND.accent}80` }} /> Month 3</span>
                                <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full inline-block bg-emerald-500" /> Month 6</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                    <p className="text-[10px] text-gray-400 flex items-center gap-1"><Shield className="h-3 w-3" /> Demo data — your analysis is private</p>
                    <button onClick={() => onNavigate?.('registration')} className="text-[10px] font-semibold flex items-center gap-0.5" style={{ color: BRAND.primary }}>
                      Run mine <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Trust bar ── */}
          <div className="border-b border-gray-100">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
                {[
                  { icon: Users, value: '14,200+', label: 'Professionals assessed' },
                  { icon: Briefcase, value: '120+', label: 'Roles mapped' },
                  { icon: BarChart3, value: '50', label: 'Competencies scored' },
                  { icon: Activity, value: '7', label: 'Industry cohorts' },
                  { icon: Star, value: '4.9 / 5', label: 'User satisfaction' },
                ].map(({ icon: Icon, value, label }) => (
                  <div key={label} className="flex flex-col items-center gap-1">
                    <Icon className="h-4 w-4 text-gray-300 mb-0.5" />
                    <p className="text-base font-extrabold" style={{ color: BRAND.primary }}>{value}</p>
                    <p className="text-[10px] text-gray-400">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── How it works ── */}
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
            <div className="mb-6">
              <h2 className="text-lg font-bold" style={{ color: BRAND.primary }}>How the platform works</h2>
              <p className="text-xs text-gray-400 mt-0.5">From raw assessment data to actionable intelligence — in four stages</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  step: '01', color: BRAND.primary, icon: GraduationCap,
                  title: 'Adaptive Assessment',
                  desc: 'A 40-minute role-adaptive assessment across 10 competency domains. Questions calibrate in real time based on prior answers to maximise score precision.',
                  tags: ['40 min', '10 domains', 'Role-adaptive'],
                },
                {
                  step: '02', color: BRAND.accent, icon: BarChart3,
                  title: 'Competency Scoring',
                  desc: 'Raw responses are converted to weighted domain scores using a confidence-adjusted model. Each of 50 competencies receives a 0–100 score with a confidence interval.',
                  tags: ['50 competencies', 'Confidence-weighted', '0–100 scale'],
                },
                {
                  step: '03', color: '#0B3C5D', icon: Activity,
                  title: 'Cohort Benchmarking',
                  desc: 'Your scores are compared against the relevant cohort: same industry, role family, and career stage. Gaps are measured vs. the P75 threshold — the industry top-quartile.',
                  tags: ['P75 threshold', 'Stage-calibrated', '7 industries'],
                },
                {
                  step: '04', color: '#4ECDC4', icon: Lightbulb,
                  title: 'Predictive Intelligence',
                  desc: 'The engine generates role-fit probability, hiring success prediction, 6-month growth trajectories, and prioritised learning interventions — all updated on every re-assessment.',
                  tags: ['Role-fit %', 'Hiring prediction', 'Growth simulation'],
                },
              ].map(({ step, color, icon: Icon, title, desc, tags }) => (
                <div key={step} className="border border-gray-200 rounded-xl p-5 bg-white relative">
                  <div className="text-[10px] font-black text-gray-200 absolute top-4 right-4">{step}</div>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-gray-100 mb-3" style={{ backgroundColor: `${color}10` }}>
                    <Icon className="h-4 w-4" style={{ color }} />
                  </div>
                  <h3 className="text-sm font-bold mb-1.5" style={{ color: BRAND.primary }}>{title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed mb-3">{desc}</p>
                  <div className="flex flex-wrap gap-1">
                    {tags.map(t => <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full border border-gray-200 text-gray-400 font-medium">{t}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Platform modules ── */}
          <div className="border-t border-gray-100 bg-gray-50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: BRAND.primary }}>All six platform modules</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Click to explore any module in detail</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {([
                  {
                    icon: Target, color: '#ef4444', title: 'Gap Analysis', screen: 'competency-gap-analysis' as Screen,
                    desc: 'Measures the distance between your current competency scores and the P75 benchmark for your industry, role, and career stage. Gaps are severity-ranked: critical, high, medium, or low.',
                    outputs: ['Weighted gap score', 'Severity classification', 'Priority ranking', 'Domain breakdown'],
                    stat: '50 competencies mapped',
                  },
                  {
                    icon: Activity, color: '#0B3C5D', title: 'Industry Benchmarks', screen: 'competency-benchmarks' as Screen,
                    desc: 'Positions your scores on the full percentile distribution for your industry cohort. See your P25, median, P75, and P90 position across every competency.',
                    outputs: ['Full percentile position', '7-industry comparison', 'Cohort size disclosure', 'Quarterly recalibration'],
                    stat: '7 industry cohorts',
                  },
                  {
                    icon: TrendingUp, color: '#f59e0b', title: 'Career Stage Analysis', screen: 'competency-career-stages' as Screen,
                    desc: 'Calibrates every benchmark to your exact career stage. Scores a Junior differently from a Senior — and calculates your promotion readiness score and time-to-next-stage estimate.',
                    outputs: ['Stage classification', 'Stage-calibrated P75', 'Promotion readiness %', 'Time-to-next-stage'],
                    stat: '4 career stages',
                  },
                  {
                    icon: Award, color: BRAND.primary, title: 'Hiring Prediction Engine', screen: 'competency-hiring-prediction' as Screen,
                    desc: 'Scores candidate role-fit probability and predicts hiring outcome based on competency benchmarks, career stage alignment, and behavioural signals.',
                    outputs: ['Role-fit probability %', 'Attrition risk score', 'Performance prediction', 'Stage alignment check'],
                    stat: '93% prediction accuracy',
                  },
                  {
                    icon: BarChart3, color: '#4ECDC4', title: 'Growth Simulation', screen: 'competency-growth-simulation' as Screen,
                    desc: 'Projects 6-month competency trajectories at the domain level using learning velocity data and intervention completion rates. Includes scenario modelling.',
                    outputs: ['Month-3 / Month-6 projections', 'Domain-level trajectories', 'Scenario modelling', 'Milestone tracking'],
                    stat: '6-month time horizon',
                  },
                  {
                    icon: Lightbulb, color: BRAND.accent, title: 'Learning Paths', screen: 'competency-learning-paths' as Screen,
                    desc: 'Auto-generates a prioritised learning intervention plan ranked by gap severity, career stage relevance, and estimated impact on role-fit score.',
                    outputs: ['Prioritised by gap severity', 'Stage-appropriate content', 'Duration estimates', 'Provider recommendations'],
                    stat: 'Gap-weighted ranking',
                  },
                ] as Array<{ icon: React.ElementType; color: string; title: string; screen: Screen; desc: string; outputs: string[]; stat: string }>).map(({ icon: Icon, color, title, screen, desc, outputs, stat }) => (
                  <button key={title} onClick={() => onNavigate?.(screen)}
                    className="bg-white border border-gray-200 rounded-xl p-5 text-left hover:border-gray-300 hover:shadow-sm transition-all group">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md flex items-center justify-center border border-gray-100 flex-shrink-0" style={{ backgroundColor: `${color}10` }}>
                          <Icon className="h-3.5 w-3.5" style={{ color }} />
                        </div>
                        <h3 className="text-sm font-bold" style={{ color: BRAND.primary }}>{title}</h3>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed mb-3">{desc}</p>
                    <div className="space-y-1 mb-3">
                      {outputs.map(o => (
                        <div key={o} className="flex items-center gap-1.5 text-[10px] text-gray-600">
                          <CheckCircle className="h-2.5 w-2.5 flex-shrink-0" style={{ color }} />
                          {o}
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-gray-100 pt-2 mt-2">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border" style={{ color, borderColor: `${color}30`, backgroundColor: `${color}08` }}>{stat}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Scoring methodology ── */}
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
            <div className="border border-gray-200 rounded-xl p-6 bg-white">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="h-4 w-4" style={{ color: BRAND.primary }} />
                    <h3 className="text-sm font-bold" style={{ color: BRAND.primary }}>Scoring methodology</h3>
                    <Badge variant="outline" className="text-[10px] ml-1">P75 benchmark standard</Badge>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed mb-4">
                    MetryxOne uses a P75 benchmark standard — meaning your target for each competency is the score achieved by the top quartile of professionals in your role, industry, and career stage. Gaps are measured as the weighted distance between your score and this threshold. Only competencies where you fall below P75 are classified as gaps; those above are classified as strengths.
                  </p>
                  <div className="space-y-2.5">
                    {[
                      { label: 'Score range', value: '0 – 100 per competency' },
                      { label: 'Benchmark threshold', value: 'P75 of relevant cohort' },
                      { label: 'Gap calculation', value: 'Weighted distance below P75' },
                      { label: 'Confidence adjustment', value: 'Applied to raw scores < 60% confidence' },
                      { label: 'Recalibration cycle', value: 'Cohort data refreshed quarterly' },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-start justify-between text-xs gap-4 py-1.5 border-b border-gray-50 last:border-0">
                        <span className="text-gray-400 font-medium flex-shrink-0">{label}</span>
                        <span className="text-gray-700 font-semibold text-right">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-3">10 competency domains covered</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { domain: 'Cognitive & Analytical', count: 6 },
                      { domain: 'Communication', count: 5 },
                      { domain: 'Leadership & Management', count: 7 },
                      { domain: 'Technical Proficiency', count: 5 },
                      { domain: 'Emotional Intelligence', count: 5 },
                      { domain: 'Strategic Thinking', count: 5 },
                      { domain: 'Collaboration', count: 4 },
                      { domain: 'Learning Agility', count: 4 },
                      { domain: 'Execution & Delivery', count: 5 },
                      { domain: 'Ethics & Integrity', count: 4 },
                    ].map(({ domain, count }) => (
                      <div key={domain} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                        <span className="text-[10px] text-gray-600 font-medium">{domain}</span>
                        <span className="text-[10px] font-bold px-1.5 py-px rounded-full border border-gray-200 text-gray-400">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Industry × role coverage ── */}
          <div className="border-t border-gray-100 bg-gray-50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
              <div className="mb-6">
                <h2 className="text-lg font-bold" style={{ color: BRAND.primary }}>Industry and role coverage</h2>
                <p className="text-xs text-gray-400 mt-0.5">7 industries · 120+ role mappings · 4 career stages per role</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { industry: 'Technology', color: '#0B3C5D', roles: ['Software Engineer', 'Product Manager', 'Data Scientist', 'Engineering Manager', 'CTO'], cohort: '4,100+' },
                  { industry: 'Finance', color: '#f59e0b', roles: ['Financial Analyst', 'Risk Manager', 'Investment Banker', 'CFO', 'Compliance Officer'], cohort: '2,800+' },
                  { industry: 'Healthcare', color: '#4ECDC4', roles: ['Clinical Lead', 'Hospital Administrator', 'Medical Director', 'Nurse Manager', 'CMO'], cohort: '2,400+' },
                  { industry: 'Education', color: BRAND.primary, roles: ['School Principal', 'Curriculum Designer', 'Academic Director', 'Education Consultant'], cohort: '1,200+' },
                  { industry: 'Manufacturing', color: '#ef4444', roles: ['Operations Manager', 'Plant Director', 'Supply Chain Lead', 'Quality Manager'], cohort: '1,100+' },
                  { industry: 'Consulting', color: BRAND.accent, roles: ['Associate Consultant', 'Senior Consultant', 'Engagement Manager', 'Partner'], cohort: '1,600+' },
                  { industry: 'E-Commerce', color: '#4ECDC4', roles: ['Growth Manager', 'Category Lead', 'E-Commerce Director', 'Customer Success'], cohort: '1,000+' },
                  { industry: 'All industries', color: '#94a3b8', roles: ['Universal competency set applies cross-industry for general roles'], cohort: '14,200+ total' },
                ].map(({ industry, color, roles, cohort }) => (
                  <div key={industry} className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2.5">
                      <h4 className="text-xs font-bold" style={{ color }}>{industry}</h4>
                      <span className="text-[9px] text-gray-400 font-semibold">{cohort}</span>
                    </div>
                    <div className="space-y-1">
                      {roles.map(r => (
                        <div key={r} className="flex items-center gap-1.5 text-[10px] text-gray-500">
                          <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                          {r}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Testimonials ── */}
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-center mb-5">What practitioners say</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { quote: 'We replaced our entire annual 360-review cycle with MetryxOne. The gap analysis replaced subjective manager impressions with numbers — and our promotion conversations are now 10× more defensible.', name: 'Yolanda F.', role: 'VP People Operations', co: 'SaaS, Series C' },
                { quote: 'The hiring prediction engine called two underperformance cases before we made the offer. We now run every shortlist through it before final interviews — it has genuinely changed how we hire.', name: 'Ravi M.', role: 'Head of Talent Acquisition', co: 'FinTech, 2,400 employees' },
                { quote: 'My career stage report told me I was in the 78th percentile for my level. My manager thought I was average. Walked into my review with the data and got the promotion I\'d been waiting 18 months for.', name: 'Christelle O.', role: 'Senior Data Analyst → Lead', co: 'Healthcare Technology' },
              ].map(t => (
                <div key={t.name} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />)}
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed mb-3 italic">"{t.quote}"</p>
                  <div className="border-t border-gray-100 pt-2.5">
                    <p className="text-xs font-semibold" style={{ color: BRAND.primary }}>{t.name}</p>
                    <p className="text-[10px] text-gray-400">{t.role} · {t.co}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── CTA ── */}
          <div className="border-t border-gray-100 bg-gray-50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div>
                  <h3 className="text-xl font-extrabold mb-2" style={{ color: BRAND.primary }}>See your full competency profile</h3>
                  <p className="text-xs text-gray-500 leading-relaxed mb-5">
                    Complete a 40-minute adaptive assessment and receive your gap report, percentile position, role-fit score, and growth simulation — all benchmarked against 14,200+ professionals in your industry.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={() => onNavigate?.('registration')} style={{ backgroundColor: BRAND.primary }} className="text-white px-6 font-semibold">
                      Start Free Assessment <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                    </Button>
                    <Button variant="outline" onClick={() => onNavigate?.('login')} className="px-5">Log In</Button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-3 flex items-center gap-1">
                    <Shield className="h-3 w-3" /> SOC 2 Type II · GDPR compliant · Data never sold
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Clock, label: '40 minutes', desc: 'Typical assessment time for a complete competency profile' },
                    { icon: BarChart3, label: '50 scores', desc: 'Individual competency scores across 10 domains' },
                    { icon: Activity, label: 'P75 benchmark', desc: 'Your gap measured vs the industry top quartile' },
                    { icon: Zap, label: 'Real-time', desc: 'Results available immediately on completion' },
                  ].map(({ icon: Icon, label, desc }) => (
                    <div key={label} className="border border-gray-200 rounded-lg p-3 bg-white">
                      <Icon className="h-3.5 w-3.5 mb-1.5" style={{ color: BRAND.primary }} />
                      <p className="text-xs font-bold mb-0.5" style={{ color: BRAND.primary }}>{label}</p>
                      <p className="text-[10px] text-gray-400 leading-relaxed">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </main>
        <Footer onNavigate={onNavigate!} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <AppTopBar
        title="Competency Intelligence"
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        onSearch={() => setShowSearch(true)}
        onTour={() => setShowTour(true)}
        onLogout={() => onNavigate?.('landing')}
      />

      {/* Sub-header with tabs */}
      <div className="border-b border-gray-200 bg-white pt-[56px] sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-gray-200" style={{ backgroundColor: `${BRAND.primary}10` }}>
                <Brain className="h-4 w-4" style={{ color: BRAND.primary }} />
              </div>
              <div>
                <h1 className="text-sm font-bold" style={{ color: BRAND.primary }}>Competency Intelligence</h1>
                {profileQuery.data && (
                  <p className="text-xs text-gray-400">
                    {profileQuery.data.current_job_role} → {profileQuery.data.target_job_role}
                  </p>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => { qc.invalidateQueries(); }} className="h-7 text-xs">
              <RefreshCw className="h-3 w-3 mr-1" /> Refresh
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex gap-0.5 overflow-x-auto scrollbar-hide">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border ${
                    isActive
                      ? 'text-white border-transparent'
                      : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-100'
                  }`}
                  style={isActive ? { backgroundColor: BRAND.primary } : {}}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">

        {/* ── TAB: PROFILE ────────────────────────────────────────────── */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" style={{ color: BRAND.accent }} />
                    Career Profile
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setEditingProfile(!editingProfile)}>
                    {editingProfile ? 'Cancel' : 'Edit'}
                  </Button>
                </CardHeader>
                <CardContent>
                  {profileQuery.isLoading ? (
                    <div className="py-8 text-center text-gray-400 text-sm">Loading profile...</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {(['currentRole', 'targetRole', 'industry', 'careerStage', 'experienceYears'] as const).map(field => {
                        const labels: Record<string, string> = { currentRole: 'Current Role', targetRole: 'Target Role', industry: 'Industry', careerStage: 'Career Stage', experienceYears: 'Experience (Years)' };
                        return (
                          <div key={field} className="space-y-1">
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{labels[field]}</label>
                            {editingProfile ? (
                              field === 'careerStage' ? (
                                <Select value={profileForm.careerStage} onValueChange={v => setProfileForm(p => ({ ...p, careerStage: v }))}>
                                  <SelectTrigger className="h-8 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {STAGES.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              ) : field === 'industry' ? (
                                <Select value={profileForm.industry} onValueChange={v => setProfileForm(p => ({ ...p, industry: v }))}>
                                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              ) : field === 'currentRole' || field === 'targetRole' ? (
                                <Select value={profileForm[field]} onValueChange={v => setProfileForm(p => ({ ...p, [field]: v }))}>
                                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <input
                                  type="number" value={profileForm.experienceYears} min={0} max={40}
                                  onChange={e => setProfileForm(p => ({ ...p, experienceYears: parseInt(e.target.value) || 0 }))}
                                  className="w-full h-8 text-sm px-2 border border-gray-300 rounded-md"
                                />
                              )
                            ) : (
                              <p className="text-sm font-medium text-gray-900">
                                {field === 'experienceYears' ? `${profileForm.experienceYears} years` : profileForm[field] || '—'}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {editingProfile && (
                    <div className="mt-4 flex gap-2 justify-end">
                      <Button size="sm" onClick={() => saveProfileMutation.mutate()} disabled={saveProfileMutation.isPending} style={{ backgroundColor: BRAND.primary }} className="text-white">
                        {saveProfileMutation.isPending ? 'Saving...' : 'Save Profile'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Role library — required competencies from the bigger O*NET-backed library */}
              <Card className="mt-6 border border-gray-200 shadow-none">
                <CardHeader className="py-3 px-4 border-b border-gray-100">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Award className="h-3.5 w-3.5" style={{ color: BRAND.primary }} />
                      Required Competencies for Your Target Role
                    </CardTitle>
                    {roleLib?.resolved && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400">
                          {roleLib.resolved.title}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {roleLib.resolved.source === 'onet' ? 'O*NET data' : 'Curated library'}
                        </Badge>
                        {roleLib.counts?.total > 0 && (
                          <Badge variant="outline" className="text-[10px]">
                            {roleLib.counts.total} competencies
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  {roleLibQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                      <div className="w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${BRAND.accent} transparent transparent transparent` }} />
                      Resolving your role against the competency library...
                    </div>
                  ) : !roleLib || !roleLib.resolved || (roleLib.requiredCompetencies?.length ?? 0) === 0 ? (
                    <div className="flex items-start gap-2 rounded-lg bg-gray-50 border border-gray-100 p-3">
                      <Info className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-gray-500 leading-relaxed">
                        {roleLib?.note ?? 'Add a target role to your profile to see the competencies it requires.'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {roleLib.requiredCompetencies.map((c: any) => {
                        const isCore = c.importanceTier === 'core';
                        return (
                          <div key={c.code} className="rounded-lg border border-gray-200 p-3">
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <div>
                                <p className="text-xs font-semibold text-gray-700">{c.name}</p>
                                {c.category && <p className="text-[10px] text-gray-400">{c.category}</p>}
                              </div>
                              <span
                                className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full whitespace-nowrap"
                                style={isCore
                                  ? { backgroundColor: `${BRAND.primary}15`, color: BRAND.primary }
                                  : { backgroundColor: '#f1f5f9', color: '#64748b' }}
                              >
                                {isCore ? 'Core' : 'Secondary'}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-500">
                              <span>Weight: <strong className="text-gray-700">{c.weight}</strong></span>
                              {(c.minProficiency || c.targetProficiency) && (
                                <span>
                                  Proficiency:{' '}
                                  <strong className="text-gray-700">
                                    {c.minProficiency ?? '—'} → {c.targetProficiency ?? '—'}
                                  </strong>
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right column: quick stats */}
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-gray-500 mb-3">Platform Overview</p>
                  <div className="space-y-3">
                    {[
                      { icon: Brain, label: '7 Domains', sub: '50 Competencies' },
                      { icon: Activity, label: 'Live Benchmarks', sub: 'Cohort comparison' },
                      { icon: Target, label: 'Gap Analysis', sub: 'Prioritized by weight' },
                      { icon: Award, label: 'Role Fit Score', sub: 'Hiring prediction' },
                      { icon: Lightbulb, label: 'Interventions', sub: 'Courses, projects, mentors' },
                    ].map(({ icon: Icon, label, sub }) => (
                      <div key={label} className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}15` }}>
                          <Icon className="h-3.5 w-3.5" style={{ color: BRAND.primary }} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-800">{label}</p>
                          <p className="text-[10px] text-gray-400">{sub}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-gray-500 mb-3">Quick Navigation</p>
                  <div className="flex flex-col gap-2">
                    {TABS.filter(t => t.id !== 'profile').map(tab => {
                      const Icon = tab.icon;
                      return (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 border border-gray-100 transition-colors text-left">
                          <span className="flex items-center gap-2 text-xs font-medium text-gray-700">
                            <Icon className="h-3.5 w-3.5" style={{ color: BRAND.accent }} />
                            {tab.label}
                          </span>
                          <ArrowRight className="h-3 w-3 text-gray-400" />
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ── TAB: COMPETENCY SCORES ────────────────────────────────── */}
        {activeTab === 'scores' && (
          <div className="space-y-5">
            {scoresQuery.isLoading ? (
              <Card><CardContent className="p-8 text-center text-gray-400">Loading competency scores...</CardContent></Card>
            ) : scoresQuery.error ? (
              <Card><CardContent className="p-8 text-center text-red-500">Failed to load scores.</CardContent></Card>
            ) : !scoresQuery.data?.domains?.length ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Brain className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500 mb-3">No competency scores yet.</p>
                  <p className="text-xs text-gray-400">Run an assessment or upload your CV to generate scores.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Overall Score', value: scoresQuery.data.overallScore, suffix: '/100', color: BRAND.primary },
                    { label: 'Domains', value: scoresQuery.data.domains?.length, suffix: '', color: BRAND.accent },
                    { label: 'Competencies', value: scoresQuery.data.totalCompetencies, suffix: '', color: '#4ECDC4' },
                    { label: 'Top Domain', value: scoresQuery.data.domains?.[0]?.avgScore, suffix: '/100', color: '#f59e0b' },
                  ].map(stat => (
                    <Card key={stat.label}>
                      <CardContent className="p-4">
                        <p className="text-xs text-gray-500">{stat.label}</p>
                        <p className="text-2xl font-bold mt-0.5" style={{ color: stat.color }}>
                          {stat.value}<span className="text-sm font-normal text-gray-400">{stat.suffix}</span>
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {scoresQuery.data.domains?.map((domain: DomainScore) => (
                  <Card key={domain.domainCode}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: BRAND.primary }}>
                            {domain.domainCode}
                          </div>
                          {domain.domainName}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{domain.competencies.length} competencies</span>
                          <span className="text-sm font-bold" style={{ color: BRAND.primary }}>Avg: {domain.avgScore}</span>
                        </div>
                      </div>
                      <ScoreBar score={domain.avgScore} height={4} />
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {domain.competencies.map((c: CompetencyScore) => (
                          <div key={c.competencyCode} className="grid grid-cols-[1fr_auto] gap-3 items-center py-1.5 border-b border-gray-50 last:border-0">
                            <div>
                              <p className="text-xs font-medium text-gray-800">{c.competencyName}</p>
                              <p className="text-[10px] text-gray-400">{c.competencyCode}</p>
                            </div>
                            <div className="w-32 sm:w-48">
                              <ScoreBar score={c.finalScore} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </div>
        )}

        {/* ── TAB: BENCHMARK ───────────────────────────────────────── */}
        {activeTab === 'benchmark' && (
          <div className="space-y-5">
            {benchmarkQuery.isLoading ? (
              <Card><CardContent className="p-8 text-center text-gray-400">Loading benchmark data...</CardContent></Card>
            ) : benchmarkQuery.error ? (
              <Card><CardContent className="p-8 text-center text-red-500">Failed to load benchmarks.</CardContent></Card>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-gray-500">Overall Percentile</p>
                      <p className="text-3xl font-bold mt-0.5" style={{ color: BRAND.primary }}>
                        {benchmarkQuery.data?.overallPercentile}<span className="text-sm text-gray-400">th</span>
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-gray-500">Role Cohort</p>
                      <p className="text-sm font-bold text-gray-800 mt-1">{benchmarkQuery.data?.role}</p>
                      <p className="text-[10px] text-gray-400 capitalize">{benchmarkQuery.data?.careerStage} level</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-gray-500">Above Median</p>
                      <p className="text-2xl font-bold mt-0.5" style={{ color: BRAND.accent }}>
                        {benchmarkQuery.data?.percentiles?.filter((p: PercentileRow) => p.vsMedian > 0).length ?? 0}
                        <span className="text-sm font-normal text-gray-400"> / {benchmarkQuery.data?.percentiles?.length ?? 0}</span>
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Percentile Rankings vs Cohort</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {benchmarkQuery.data?.percentiles?.map((p: PercentileRow) => (
                        <div key={p.competencyCode} className="grid grid-cols-[180px_1fr_auto_auto] gap-3 items-center">
                          <div>
                            <p className="text-xs font-medium text-gray-800 truncate">{p.competencyName}</p>
                            <p className="text-[10px] text-gray-400">{p.domainName}</p>
                          </div>
                          <div className="relative">
                            <div className="h-6 bg-gray-100 rounded overflow-hidden flex items-center">
                              <div className="h-full bg-opacity-30 transition-all" style={{ width: `${p.percentile}%`, backgroundColor: p.percentile >= 75 ? '#4ECDC4' : p.percentile >= 50 ? BRAND.accent : '#f59e0b', opacity: 0.7 }} />
                              <div className="absolute left-0 right-0 px-2 text-[10px] font-semibold text-gray-700">
                                Score: {p.userScore} &bull; Mean: {Math.round(p.benchmarkMean)}
                              </div>
                            </div>
                          </div>
                          <span className="text-xs font-bold w-12 text-right" style={{ color: p.percentile >= 75 ? '#4ECDC4' : p.percentile >= 50 ? BRAND.accent : '#f59e0b' }}>
                            {p.percentile}th
                          </span>
                          <span className={`text-xs font-medium w-12 text-right ${p.vsMedian >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {p.vsMedian >= 0 ? '+' : ''}{p.vsMedian}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {/* ── TAB: GAP ANALYSIS ────────────────────────────────────── */}
        {activeTab === 'gap' && (
          <div className="space-y-5">
            {gapQuery.isLoading ? (
              <Card><CardContent className="p-8 text-center text-gray-400">Analyzing gaps...</CardContent></Card>
            ) : gapQuery.error ? (
              <Card><CardContent className="p-8 text-center text-red-500">Failed to load gap analysis.</CardContent></Card>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { label: 'Critical', key: 'critical', color: '#ef4444' },
                    { label: 'High', key: 'high', color: '#D97706' },
                    { label: 'Medium', key: 'medium', color: '#f59e0b' },
                    { label: 'Low', key: 'low', color: '#0B3C5D' },
                    { label: 'Strengths', key: 'strengths', color: '#4ECDC4' },
                  ].map(({ label, key, color }) => (
                    <Card key={key}>
                      <CardContent className="p-3">
                        <p className="text-[10px] text-gray-500 uppercase">{label}</p>
                        <p className="text-2xl font-bold" style={{ color }}>{gapQuery.data?.summary?.[key] ?? 0}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Gap Prioritization — Target: {gapQuery.data?.targetRole}</CardTitle>
                      <span className="text-xs text-gray-400">Total Weighted Gap: <strong>{gapQuery.data?.summary?.totalWeightedGap}</strong></span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left pb-2 font-medium text-gray-500 pr-3">Competency</th>
                            <th className="text-left pb-2 font-medium text-gray-500 pr-3">Domain</th>
                            <th className="text-center pb-2 font-medium text-gray-500 w-16 pr-3">Your Score</th>
                            <th className="text-center pb-2 font-medium text-gray-500 w-16 pr-3">Target</th>
                            <th className="text-center pb-2 font-medium text-gray-500 w-16 pr-3">Gap</th>
                            <th className="text-center pb-2 font-medium text-gray-500 w-20 pr-3">W.Gap</th>
                            <th className="text-center pb-2 font-medium text-gray-500 w-20">Level</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gapQuery.data?.gaps?.map((g: GapRow, i: number) => (
                            <tr key={g.competencyId} className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                              <td className="py-1.5 pr-3 font-medium text-gray-800">{g.competencyName}</td>
                              <td className="py-1.5 pr-3 text-gray-500">{g.domainName}</td>
                              <td className="py-1.5 pr-3 text-center font-semibold" style={{ color: BRAND.primary }}>{g.userScore}</td>
                              <td className="py-1.5 pr-3 text-center text-gray-500">{Math.round(g.targetScore)}</td>
                              <td className={`py-1.5 pr-3 text-center font-semibold ${g.gap > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                {g.gap > 0 ? `-${g.gap}` : `+${Math.abs(g.gap)}`}
                              </td>
                              <td className="py-1.5 pr-3 text-center text-gray-600">{g.weightedGap}</td>
                              <td className="py-1.5 text-center"><GapBadge level={g.gapLevel} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {/* ── TAB: ROLE FIT ─────────────────────────────────────────── */}
        {activeTab === 'rolefit' && (
          <div className="space-y-5">
            {roleFitQuery.isLoading ? (
              <Card><CardContent className="p-8 text-center text-gray-400">Computing role fitness...</CardContent></Card>
            ) : roleFitQuery.error ? (
              <Card><CardContent className="p-8 text-center text-red-500">Failed to compute role fitness.</CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-1 space-y-4">
                  <Card>
                    <CardContent className="p-6 flex flex-col items-center text-center">
                      <div className="relative w-36 h-36 mb-4">
                        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                          <circle cx="50" cy="50" r="44" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                          <circle cx="50" cy="50" r="44" fill="none" strokeWidth="10"
                            stroke={roleFitQuery.data?.probability >= 75 ? '#4ECDC4' : roleFitQuery.data?.probability >= 55 ? BRAND.accent : roleFitQuery.data?.probability >= 35 ? '#f59e0b' : '#ef4444'}
                            strokeDasharray={`${roleFitQuery.data?.probability * 2.76} 276`}
                            strokeLinecap="round" className="transition-all duration-700"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-3xl font-bold" style={{ color: BRAND.primary }}>{roleFitQuery.data?.probability}%</span>
                          <span className="text-[10px] text-gray-400">Fit Score</span>
                        </div>
                      </div>
                      <ReadinessBadge level={roleFitQuery.data?.readinessLevel ?? ''} />
                      <p className="text-xs text-gray-500 mt-2">Target: <strong>{roleFitQuery.data?.targetRole}</strong></p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4 space-y-2">
                      {[
                        { label: 'Critical Gaps', value: roleFitQuery.data?.criticalGaps, color: '#ef4444' },
                        { label: 'High Gaps', value: roleFitQuery.data?.highGaps, color: '#D97706' },
                        { label: 'Weighted Score', value: `${roleFitQuery.data?.weightedScore}%`, color: BRAND.primary },
                        { label: 'Overall Score', value: `${roleFitQuery.data?.overallScore}/100`, color: BRAND.accent },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                          <span className="text-xs text-gray-500">{label}</span>
                          <span className="text-sm font-bold" style={{ color }}>{value}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                <div className="lg:col-span-2 space-y-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Star className="h-4 w-4 text-emerald-500" /> Top Strengths for this Role
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {roleFitQuery.data?.topStrengths?.map((s: string) => (
                          <span key={s} className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">{s}</span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" /> Priority Development Areas
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {roleFitQuery.data?.topGaps?.map((g: string) => (
                          <span key={g} className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">{g}</span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Top Contributing Factors</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2.5">
                        {roleFitQuery.data?.factors?.map((f: RoleFitFactor, i: number) => (
                          <div key={i} className="grid grid-cols-[1fr_auto] gap-3 items-center">
                            <div>
                              <p className="text-xs font-medium text-gray-800">{f.label}</p>
                              <div className="mt-0.5">
                                <ScoreBar score={f.score} height={6} />
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold" style={{ color: BRAND.primary }}>×{f.weight.toFixed(2)}</p>
                              <p className="text-[10px] text-gray-400">weight</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: RECOMMENDATIONS ─────────────────────────────────── */}
        {activeTab === 'reco' && (
          <div className="space-y-5">
            {recoQuery.isLoading ? (
              <Card><CardContent className="p-8 text-center text-gray-400">Loading recommendations...</CardContent></Card>
            ) : recoQuery.error ? (
              <Card><CardContent className="p-8 text-center text-red-500">Failed to load recommendations.</CardContent></Card>
            ) : !recoQuery.data?.interventions?.length ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <CheckCircle className="h-10 w-10 mx-auto mb-3 text-emerald-400" />
                  <p className="text-gray-600 font-medium mb-1">{recoQuery.data?.message ?? 'No significant gaps found.'}</p>
                  <p className="text-xs text-gray-400">Your scores are at or above the benchmark. Keep developing to stay ahead.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(['course', 'project', 'mentorship'] as const).map(type => {
                    const count = recoQuery.data?.interventions?.filter((i: InterventionItem) => i.type === type).length ?? 0;
                    const icons = { course: BookOpen, project: Briefcase, mentorship: Users };
                    const colors = { course: '#0B3C5D', project: '#0B3C5D', mentorship: '#4ECDC4' };
                    const Icon = icons[type];
                    return (
                      <Card key={type}>
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${colors[type]}15` }}>
                            <Icon className="h-5 w-5" style={{ color: colors[type] }} />
                          </div>
                          <div>
                            <p className="text-lg font-bold" style={{ color: colors[type] }}>{count}</p>
                            <p className="text-xs text-gray-500 capitalize">{type}s</p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {(['critical', 'high', 'medium', 'low'] as const).map(priority => {
                  const group = recoQuery.data?.interventions?.filter((i: InterventionItem) => i.gap_level === priority) ?? [];
                  if (!group.length) return null;
                  const sectionLabels: Record<string, { label: string; color: string; bg: string }> = {
                    critical: { label: 'Critical Priority', color: '#ef4444', bg: '#fef2f2' },
                    high: { label: 'High Priority', color: '#D97706', bg: '#fff7ed' },
                    medium: { label: 'Medium Priority', color: '#f59e0b', bg: '#fffbeb' },
                    low: { label: 'Low Priority', color: '#0B3C5D', bg: 'rgba(11,60,93,0.06)' },
                  };
                  const { label, color, bg } = sectionLabels[priority];
                  return (
                    <div key={priority} className="space-y-2">
                      <div className="flex items-center gap-2 px-1">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-xs font-semibold" style={{ color }}>{label}</span>
                        <span className="text-[10px] text-gray-400">({group.length})</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {group.map((item: InterventionItem) => (
                          <Card key={item.id} className="hover:shadow-md transition-shadow" style={{ borderLeft: `3px solid ${color}` }}>
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: bg }}>
                                  <InterventionTypeIcon type={item.type} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-gray-800 mb-0.5">{item.title}</p>
                                  <p className="text-[11px] text-gray-500 mb-2 line-clamp-2">{item.description}</p>
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <span className="text-[10px] text-gray-400"><strong>For:</strong> {item.competency_name}</span>
                                    {item.provider && <span className="text-[10px] text-gray-400"><strong>Provider:</strong> {item.provider}</span>}
                                    {item.duration_weeks && (
                                      <span className="text-[10px] text-gray-400">
                                        <Clock className="inline h-2.5 w-2.5 mr-0.5" />{item.duration_weeks}w
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {activeTab === 'intelligence' && (
          <div className="space-y-5">
            <IntelligenceLayers title="Competency Intelligence Layers" userId={userId || undefined} />
          </div>
        )}
      </div>

      <Footer onNavigate={onNavigate!} />

      {showTour && (
        <QuickTour
          type="employee"
          onClose={() => setShowTour(false)}
          onNavigate={() => {}}
        />
      )}

      {showSearch && (
        <GlobalSearch
          role="employee"
          onNavigate={(screen) => onNavigate?.(screen as any)}
          onMenuSelect={() => {}}
          onClose={() => setShowSearch(false)}
          onShowTour={() => setShowTour(true)}
        />
      )}
    </div>
  );
}
