import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Heart, Brain, Compass, BookOpen, Star, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, Clock, Target, Award, GraduationCap,
  Calendar, ChevronRight, RefreshCw, Bell,
  BarChart3, Activity, Lightbulb, Users, Lock, ArrowUpRight, Check,
} from 'lucide-react';
import type { Child } from '@shared/schema';

function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('metryx_token');
  return fetch(url, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> ?? {}),
    },
  });
}

interface Props {
  child: Child | null;
  allChildren: Child[];
  onChildChange?: (id: string) => void;
}

interface WellnessSummary { avgStress: number | null; avgEnergy: number | null; checkinsCount: number; trend: string; }
interface CareerMatch { career: string; score: number; traits: string[]; streams: string[]; }
interface Briefing { weekOf: string; childName: string; highlights: string[]; actionItems: { priority: string; action: string }[]; wellnessSummary: WellnessSummary; }
interface StudyPlan { weekOf: string; childName: string; plan: { days: { day: string; sessions: { subject: string; duration: number; time: string; type: string; tip: string }[] }[]; weeklyGoals: string[]; tips: string[]; }; }
interface Scholarship { id: string; title: string; provider: string; description: string; amount: string; deadline: string; eligibilityGrades: string[]; category: string; applyUrl: string; }
interface Subscription { plan: string; status: string; features: string[]; amount: number; expiresAt: string; }

const MOOD_OPTIONS = [
  { value: 'happy', label: '😊 Happy', color: '#4ECDC4' },
  { value: 'calm', label: '😌 Calm', color: '#1B6B9A' },
  { value: 'anxious', label: '😰 Anxious', color: '#f59e0b' },
  { value: 'sad', label: '😢 Sad', color: '#0B3C5D' },
  { value: 'excited', label: '🤩 Excited', color: '#0B3C5D' },
  { value: 'tired', label: '😴 Tired', color: '#6b7280' },
  { value: 'frustrated', label: '😤 Frustrated', color: '#ef4444' },
  { value: 'confident', label: '💪 Confident', color: '#4ECDC4' },
];

const PLAN_COLORS: Record<string, string> = { basic: '#6b7280', family: '#0B3C5D', premium: '#d97706' };
const PLAN_ICONS: Record<string, React.ReactNode> = {
  basic: <CheckCircle size={16} />, family: <Users size={16} />, premium: <Award size={16} />,
};

function StressGauge({ level }: { level: number }) {
  const color = level <= 3 ? '#4ECDC4' : level <= 5 ? '#4ECDC4' : level <= 7 ? '#f59e0b' : '#ef4444';
  const label = level <= 3 ? 'Healthy' : level <= 5 ? 'Moderate' : level <= 7 ? 'Elevated' : 'High';
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-3xl font-black" style={{ color }}>{level}</div>
      <div className="text-xs font-semibold" style={{ color }}>{label}</div>
      <Progress value={level * 10} className="w-24 h-1.5" style={{ '--tw-bg-opacity': '0.2' } as React.CSSProperties} />
    </div>
  );
}

function FeatureGate({ feature, plan, children }: { feature: string; plan: string; children: React.ReactNode }) {
  const PLAN_ORDER = ['basic', 'family', 'premium'];
  const FEATURE_PLAN: Record<string, string> = {
    career_compass: 'family', study_plan: 'family', peer_benchmarking: 'family',
    stress_alerts: 'family', tutor_matching: 'premium', mentor_access: 'premium',
    annual_portfolio: 'premium', school_connect: 'premium', parent_coaching: 'premium',
  };
  const required = FEATURE_PLAN[feature];
  if (!required) return <>{children}</>;
  const hasAccess = PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(required);
  if (hasAccess) return <>{children}</>;
  return (
    <div className="relative">
      <div className="opacity-40 pointer-events-none select-none">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-white/80 backdrop-blur-sm">
        <Lock size={20} className="text-amber-500" />
        <p className="text-xs font-semibold text-gray-600">
          Requires <span className="capitalize font-bold text-amber-600">{required}</span> plan
        </p>
      </div>
    </div>
  );
}

export function ParentEnterpriseHub({ child, allChildren, onChildChange }: Props) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('wellness');
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [wellnessSummary, setWellnessSummary] = useState<WellnessSummary | null>(null);
  const [wellnessHistory, setWellnessHistory] = useState<unknown[]>([]);
  const [careerData, setCareerData] = useState<{ careerMatches: CareerMatch[]; interestProfile: Record<string, string>; traits: Record<string, number>; } | null>(null);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [loadingWellness, setLoadingWellness] = useState(false);
  const [loadingCareer, setLoadingCareer] = useState(false);
  const [loadingBriefing, setLoadingBriefing] = useState(false);
  const [loadingStudyPlan, setLoadingStudyPlan] = useState(false);
  const [submittingCheckin, setSubmittingCheckin] = useState(false);
  const [checkinStress, setCheckinStress] = useState(5);
  const [checkinMood, setCheckinMood] = useState('calm');
  const [checkinEnergy, setCheckinEnergy] = useState(6);
  const [checkinFocus, setCheckinFocus] = useState(6);
  const [checkinSleep, setCheckinSleep] = useState('7');
  const [checkinNotes, setCheckinNotes] = useState('');
  const [selectedUpgradePlan, setSelectedUpgradePlan] = useState('family');

  const loadSubscription = useCallback(async () => {
    try {
      const r = await authFetch('/api/subscription');
      if (r.ok) setSubscription(await r.json());
    } catch { /* silent */ }
  }, []);

  const loadWellness = useCallback(async (childId: string) => {
    setLoadingWellness(true);
    try {
      const r = await authFetch(`/api/wellness/history/${childId}`);
      if (r.ok) {
        const data = await r.json();
        setWellnessSummary(data.summary);
        setWellnessHistory(data.checkins);
      }
    } catch { /* silent */ } finally { setLoadingWellness(false); }
  }, []);

  const loadCareer = useCallback(async (childId: string) => {
    setLoadingCareer(true);
    try {
      const r = await authFetch(`/api/career/${childId}`);
      if (r.ok) setCareerData(await r.json());
    } catch { /* silent */ } finally { setLoadingCareer(false); }
  }, []);

  const loadBriefing = useCallback(async (childId: string) => {
    setLoadingBriefing(true);
    try {
      const r = await authFetch(`/api/subscription/briefing/${childId}`);
      if (r.ok) setBriefing(await r.json());
    } catch { /* silent */ } finally { setLoadingBriefing(false); }
  }, []);

  const loadStudyPlan = useCallback(async (childId: string) => {
    setLoadingStudyPlan(true);
    try {
      const r = await authFetch(`/api/subscription/study-plan/${childId}`);
      if (r.ok) setStudyPlan(await r.json());
    } catch { /* silent */ } finally { setLoadingStudyPlan(false); }
  }, []);

  const loadScholarships = useCallback(async (grade?: string, board?: string) => {
    try {
      const params = new URLSearchParams();
      if (grade) params.set('grade', grade);
      if (board) params.set('board', board);
      const r = await authFetch(`/api/wellness/scholarships?${params}`);
      if (r.ok) setScholarships(await r.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  useEffect(() => {
    if (!child?.id) return;
    loadWellness(child.id);
    loadScholarships(child.grade, child.board);
    if (activeTab === 'career') loadCareer(child.id);
    if (activeTab === 'briefing') loadBriefing(child.id);
    if (activeTab === 'study-plan') loadStudyPlan(child.id);
  }, [child?.id, child?.grade, child?.board]);

  useEffect(() => {
    if (!child?.id) return;
    if (activeTab === 'career' && !careerData) loadCareer(child.id);
    if (activeTab === 'briefing' && !briefing) loadBriefing(child.id);
    if (activeTab === 'study-plan' && !studyPlan) loadStudyPlan(child.id);
  }, [activeTab, child?.id]);

  const submitCheckin = async () => {
    if (!child?.id) return;
    setSubmittingCheckin(true);
    try {
      const r = await authFetch('/api/wellness/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId: child.id, stressLevel: checkinStress, mood: checkinMood,
          energy: checkinEnergy, focus: checkinFocus,
          sleepHours: parseFloat(checkinSleep) || undefined,
          notes: checkinNotes || undefined,
        }),
      });
      const data = await r.json();
      if (r.ok) {
        setCheckinOpen(false);
        loadWellness(child.id);
        if (data.alert?.severity === 'high') {
          toast({ title: '⚠️ High Stress Alert', description: data.alert.message, variant: 'destructive' });
        } else if (data.alert?.severity === 'medium') {
          toast({ title: 'Stress Elevated', description: data.alert.message });
        } else {
          toast({ title: 'Check-in recorded', description: 'Wellness data saved successfully.' });
        }
        setCheckinNotes(''); setCheckinStress(5); setCheckinMood('calm');
        setCheckinEnergy(6); setCheckinFocus(6); setCheckinSleep('7');
      }
    } catch { toast({ title: 'Error', description: 'Could not save check-in', variant: 'destructive' }); }
    finally { setSubmittingCheckin(false); }
  };

  const handleUpgrade = async () => {
    try {
      const r = await authFetch('/api/subscription/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selectedUpgradePlan, billingCycle: 'monthly' }),
      });
      if (r.ok) {
        const data = await r.json();
        setSubscription(data.subscription);
        setUpgradeOpen(false);
        toast({ title: 'Plan upgraded!', description: `You are now on the ${selectedUpgradePlan} plan.` });
      }
    } catch { toast({ title: 'Error', description: 'Could not upgrade plan', variant: 'destructive' }); }
  };

  const trendIcon = (trend: string) =>
    trend === 'healthy' ? <TrendingUp size={14} className="text-teal-500" /> :
    trend === 'concerning' ? <TrendingDown size={14} className="text-red-500" /> :
    <Activity size={14} className="text-amber-500" />;

  const plan = subscription?.plan ?? 'basic';

  if (!child) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <GraduationCap size={40} className="text-gray-300" />
        <p className="text-gray-500 font-medium">Select a child to access the Intelligence Hub</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Subscription Banner */}
      {subscription && (
        <div className="flex items-center justify-between rounded-xl px-4 py-3 border"
          style={{ background: 'rgba(11,60,93,0.05)', borderColor: 'rgba(11,60,93,0.15)' }}>
          <div className="flex items-center gap-2">
            <span style={{ color: PLAN_COLORS[plan] }}>{PLAN_ICONS[plan]}</span>
            <span className="text-sm font-bold capitalize" style={{ color: PLAN_COLORS[plan] }}>{plan} Plan</span>
            <Badge variant="outline" className="text-xs capitalize"
              style={{ borderColor: subscription.status === 'trial' ? '#f59e0b' : PLAN_COLORS[plan], color: subscription.status === 'trial' ? '#f59e0b' : PLAN_COLORS[plan] }}>
              {subscription.status === 'trial' ? '30-day trial' : 'Active'}
            </Badge>
          </div>
          {plan !== 'premium' && (
            <Button size="sm" onClick={() => setUpgradeOpen(true)}
              style={{ background: '#0B3C5D', color: 'white', border: 'none' }}>
              <Award size={12} className="mr-1" /> Upgrade
            </Button>
          )}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full h-10 bg-gray-100 rounded-xl">
          {[
            { id: 'wellness', label: 'Wellness', icon: <Heart size={13} /> },
            { id: 'career', label: 'Career', icon: <Compass size={13} /> },
            { id: 'study-plan', label: 'Study Plan', icon: <BookOpen size={13} /> },
            { id: 'briefing', label: 'Briefing', icon: <Star size={13} /> },
            { id: 'scholarships', label: 'Scholarships', icon: <Award size={13} /> },
          ].map(tab => (
            <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-1.5 text-xs font-medium rounded-lg text-gray-500 transition-all hover:text-gray-700 data-[state=active]:bg-white data-[state=active]:text-[#0B3C5D] data-[state=active]:font-semibold data-[state=active]:shadow-sm">
              {tab.icon}{tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ─── WELLNESS TAB ─── */}
        <TabsContent value="wellness" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base" style={{ color: '#0B3C5D' }}>Stress & Wellness Tracker</h3>
              <p className="text-xs text-gray-500">Early warning system for {child.name}</p>
            </div>
            <Button size="sm" onClick={() => setCheckinOpen(true)}
              style={{ background: '#0B3C5D', color: 'white', border: 'none' }}>
              <Heart size={13} className="mr-1" /> New Check-in
            </Button>
          </div>

          {loadingWellness ? (
            <div className="flex items-center justify-center h-32 text-gray-400">Loading wellness data…</div>
          ) : wellnessSummary && wellnessSummary.checkinsCount > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Card className="border-0 shadow-sm text-center py-4">
                  <StressGauge level={Math.round(wellnessSummary.avgStress ?? 5)} />
                  <p className="text-xs text-gray-500 mt-2">Avg Stress</p>
                </Card>
                <Card className="border-0 shadow-sm text-center py-4">
                  <div className="flex flex-col items-center gap-1">
                    <div className="text-3xl font-black text-blue-500">{wellnessSummary.avgEnergy ?? '—'}</div>
                    <div className="text-xs font-semibold text-blue-500">Energy</div>
                    <Progress value={(wellnessSummary.avgEnergy ?? 5) * 10} className="w-24 h-1.5" />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Avg Energy</p>
                </Card>
                <Card className="border-0 shadow-sm text-center py-4">
                  <div className="flex flex-col items-center gap-1">
                    <div className="text-3xl font-black" style={{ color: '#4ECDC4' }}>{wellnessSummary.checkinsCount}</div>
                    <div className="flex items-center gap-1">
                      {trendIcon(wellnessSummary.trend)}
                      <span className="text-xs font-semibold capitalize text-gray-500">{wellnessSummary.trend}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">7-day checks</p>
                </Card>
              </div>

              {(wellnessSummary.avgStress ?? 0) > 7 && (
                <div className="flex items-start gap-3 rounded-xl p-4 border border-red-200 bg-red-50">
                  <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-red-700">High Stress Detected</p>
                    <p className="text-xs text-red-600 mt-0.5">
                      {child.name}'s average stress this week is {wellnessSummary.avgStress}/10. 
                      Schedule a relaxed conversation and consider reducing academic load temporarily.
                    </p>
                  </div>
                </div>
              )}

              {/* Wellness history chart */}
              {wellnessHistory.length > 0 && (
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-bold text-gray-700">7-Day History</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="space-y-2">
                      {(wellnessHistory as Record<string, unknown>[]).slice(0, 7).map((c, i) => (
                        <div key={i} className="flex items-center gap-3 text-xs">
                          <span className="text-gray-400 w-20 flex-shrink-0">
                            {new Date(c.checkedAt as string).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2 relative overflow-hidden">
                            <div className="h-full rounded-full transition-all"
                              style={{
                                width: `${(c.stressLevel as number) * 10}%`,
                                background: (c.stressLevel as number) <= 4 ? '#4ECDC4' : (c.stressLevel as number) <= 6 ? '#f59e0b' : '#ef4444',
                              }} />
                          </div>
                          <span className="font-bold w-8 text-right">{c.stressLevel as number}/10</span>
                          <span className="text-gray-500 capitalize">{c.mood as string}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="border-dashed border-2 border-gray-200 shadow-none">
              <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
                <Heart size={32} className="text-gray-300" />
                <p className="font-semibold text-gray-500">No wellness data yet</p>
                <p className="text-xs text-gray-400 text-center max-w-xs">Start tracking {child.name}'s daily mood, energy and stress to detect burnout early.</p>
                <Button size="sm" onClick={() => setCheckinOpen(true)} style={{ background: '#0B3C5D', color: 'white', border: 'none' }}>
                  Start First Check-in
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── CAREER COMPASS TAB ─── */}
        <TabsContent value="career" className="mt-4">
          <FeatureGate feature="career_compass" plan={plan}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base" style={{ color: '#0B3C5D' }}>Career Compass™</h3>
                  <p className="text-xs text-gray-500">AI-matched career paths for {child.name}</p>
                </div>
                {careerData && (
                  <Button size="sm" variant="outline" onClick={() => { loadCareer(child.id); }}
                    disabled={loadingCareer} className="text-xs gap-1">
                    <RefreshCw size={12} className={loadingCareer ? 'animate-spin' : ''} /> Refresh
                  </Button>
                )}
              </div>

              {loadingCareer ? (
                <div className="flex items-center justify-center h-32 text-gray-400">Generating career analysis…</div>
              ) : careerData ? (
                <>
                  {/* Interest Profile */}
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="text-sm font-bold text-gray-700">Interest Profile</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(careerData.interestProfile).map(([domain, level]) => (
                          <div key={domain} className="flex items-center justify-between gap-2">
                            <span className="text-xs capitalize text-gray-600 font-medium w-24">{domain.replace(/_/g, ' ')}</span>
                            <Badge variant="outline" className="text-xs capitalize"
                              style={{ borderColor: level === 'High' ? '#4ECDC4' : level === 'Moderate' ? '#f59e0b' : '#d1d5db', color: level === 'High' ? '#4ECDC4' : level === 'Moderate' ? '#d97706' : '#9ca3af' }}>
                              {level}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Career matches */}
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="text-sm font-bold text-gray-700">Top Career Matches</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-3">
                      {careerData.careerMatches.slice(0, 6).map((match, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                            style={{ background: i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#cd7c2f' : '#0B3C5D' }}>
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-semibold text-gray-800 truncate">{match.career}</span>
                              <span className="text-xs font-bold ml-2" style={{ color: '#4ECDC4' }}>{match.score}%</span>
                            </div>
                            <Progress value={match.score} className="h-1.5" />
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {match.traits.map(t => (
                                <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{t}</Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <p className="text-xs text-gray-400 text-center">
                    Based on {child.name}'s subjects, interests and LBI™ profile. 
                    Add more profile details for a more accurate analysis.
                  </p>
                </>
              ) : (
                <Card className="border-dashed border-2 border-gray-200 shadow-none">
                  <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
                    <Compass size={32} className="text-gray-300" />
                    <p className="font-semibold text-gray-500">Career analysis not generated</p>
                    <Button size="sm" onClick={() => loadCareer(child.id)}
                      style={{ background: '#0B3C5D', color: 'white', border: 'none' }}>
                      Generate Career Compass
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </FeatureGate>
        </TabsContent>

        {/* ─── STUDY PLAN TAB ─── */}
        <TabsContent value="study-plan" className="mt-4">
          <FeatureGate feature="study_plan" plan={plan}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base" style={{ color: '#0B3C5D' }}>Personalised Study Plan</h3>
                  <p className="text-xs text-gray-500">AI-generated week plan for {child.name}</p>
                </div>
                {studyPlan && (
                  <Button size="sm" variant="outline" onClick={() => loadStudyPlan(child.id)}
                    disabled={loadingStudyPlan} className="text-xs gap-1">
                    <RefreshCw size={12} className={loadingStudyPlan ? 'animate-spin' : ''} /> New Week
                  </Button>
                )}
              </div>

              {loadingStudyPlan ? (
                <div className="flex items-center justify-center h-32 text-gray-400">Generating study plan…</div>
              ) : studyPlan?.plan?.days ? (
                <>
                  {/* Weekly goals */}
                  <Card className="border-0 shadow-sm" style={{ borderLeft: '4px solid #4ECDC4' }}>
                    <CardContent className="px-4 py-3">
                      <p className="text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">This Week's Goals</p>
                      <ul className="space-y-1">
                        {studyPlan.plan.weeklyGoals?.map((goal, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                            <Target size={12} style={{ color: '#4ECDC4' }} className="flex-shrink-0" />
                            {goal}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  {/* Daily schedule */}
                  <div className="space-y-2">
                    {studyPlan.plan.days.map((day, i) => (
                      <Card key={i} className="border-0 shadow-sm">
                        <CardContent className="px-4 py-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-bold text-gray-700">{day.day}</p>
                            <Badge variant="outline" className="text-xs">{day.totalMinutes} min</Badge>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {day.sessions.map((session, j) => (
                              <div key={j} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs"
                                style={{ background: 'rgba(11,60,93,0.08)', color: '#0B3C5D' }}>
                                <BookOpen size={10} />
                                <span className="font-semibold">{session.subject}</span>
                                <span className="text-gray-400">·</span>
                                <span>{session.duration}m</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Study tips */}
                  <Card className="border-0 shadow-sm bg-amber-50">
                    <CardContent className="px-4 py-3">
                      <p className="text-xs font-bold text-amber-700 mb-2 flex items-center gap-1"><Lightbulb size={12} />Study Tips</p>
                      <ul className="space-y-1">
                        {studyPlan.plan.tips?.map((tip, i) => (
                          <li key={i} className="text-xs text-amber-700">• {tip}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="border-dashed border-2 border-gray-200 shadow-none">
                  <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
                    <BookOpen size={32} className="text-gray-300" />
                    <p className="font-semibold text-gray-500">No study plan generated</p>
                    <p className="text-xs text-gray-400 text-center max-w-xs">
                      Add study hours and favourite subjects to {child.name}'s profile to get a personalised plan.
                    </p>
                    <Button size="sm" onClick={() => loadStudyPlan(child.id)}
                      style={{ background: '#0B3C5D', color: 'white', border: 'none' }}>
                      Generate Plan
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </FeatureGate>
        </TabsContent>

        {/* ─── WEEKLY BRIEFING TAB ─── */}
        <TabsContent value="briefing" className="mt-4 space-y-4">
          <div>
            <h3 className="font-bold text-base" style={{ color: '#0B3C5D' }}>Weekly Parent Briefing</h3>
            <p className="text-xs text-gray-500">Your personalised intelligence report for this week</p>
          </div>

          {loadingBriefing ? (
            <div className="flex items-center justify-center h-32 text-gray-400">Generating briefing…</div>
          ) : briefing ? (
            <>
              <Card className="border-0 shadow-sm" style={{ background: 'rgba(11,60,93,0.05)' }}>
                <CardContent className="px-4 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Star size={16} style={{ color: '#4ECDC4' }} />
                    <span className="text-sm font-bold text-gray-700">This Week's Highlights</span>
                    <Badge variant="outline" className="text-xs ml-auto">
                      Week of {new Date(briefing.weekOf).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </Badge>
                  </div>
                  <ul className="space-y-2">
                    {briefing.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckCircle size={13} style={{ color: '#4ECDC4' }} className="flex-shrink-0 mt-0.5" />
                        {h}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <Target size={14} style={{ color: '#0B3C5D' }} /> Action Items for You
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {briefing.actionItems.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg px-3 py-2"
                      style={{ background: item.priority === 'high' ? 'rgba(239,68,68,0.08)' : item.priority === 'medium' ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)' }}>
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                        style={{ background: item.priority === 'high' ? '#ef4444' : item.priority === 'medium' ? '#f59e0b' : '#4ECDC4' }} />
                      <p className="text-xs text-gray-700">{item.action}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {briefing.wellnessSummary && (
                <Card className="border-0 shadow-sm">
                  <CardContent className="px-4 py-3 flex items-center gap-4">
                    <Heart size={18} style={{ color: '#ef4444' }} />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-600">Wellness this week</p>
                      <p className="text-xs text-gray-500 capitalize">
                        {briefing.wellnessSummary.trend === 'no_data' ? 'No check-ins recorded — start tracking today'
                          : `${briefing.wellnessSummary.checkinsCount} check-in${briefing.wellnessSummary.checkinsCount !== 1 ? 's' : ''} · Trend: ${briefing.wellnessSummary.trend}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {trendIcon(briefing.wellnessSummary.trend)}
                      <span className="text-xs font-bold capitalize text-gray-600">{briefing.wellnessSummary.trend}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="border-dashed border-2 border-gray-200 shadow-none">
              <CardContent className="flex flex-col items-center py-10 gap-3">
                <Star size={32} className="text-gray-300" />
                <p className="font-semibold text-gray-500">Briefing will appear here</p>
                <Button size="sm" onClick={() => loadBriefing(child.id)}
                  style={{ background: '#0B3C5D', color: 'white', border: 'none' }}>
                  Generate Briefing
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── SCHOLARSHIPS TAB ─── */}
        <TabsContent value="scholarships" className="mt-4 space-y-4">
          <div>
            <h3 className="font-bold text-base" style={{ color: '#0B3C5D' }}>Scholarships & Opportunities</h3>
            <p className="text-xs text-gray-500">
              {child.grade || child.board
                ? `Filtered for ${[child.grade, child.board].filter(Boolean).join(' · ')}`
                : 'All opportunities — add grade and board to filter'}
            </p>
          </div>

          {scholarships.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-2">
              <Award size={32} className="text-gray-300" />
              <p className="text-gray-500 text-sm">No scholarships found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {scholarships.map(s => (
                <Card key={s.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="px-4 py-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: s.category === 'fellowship' ? 'rgba(11,60,93,0.1)' : s.category === 'olympiad' ? 'rgba(245,158,11,0.1)' : 'rgba(11,60,93,0.1)' }}>
                        {s.category === 'fellowship' ? <Star size={16} style={{ color: '#0B3C5D' }} />
                          : s.category === 'olympiad' ? <Star size={16} style={{ color: '#f59e0b' }} />
                          : <Award size={16} style={{ color: '#0B3C5D' }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-bold text-gray-800 leading-tight">{s.title}</p>
                          <Badge variant="outline" className="text-xs flex-shrink-0 capitalize"
                            style={{ color: '#4ECDC4', borderColor: '#4ECDC4' }}>{s.category}</Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{s.provider}</p>
                        <p className="text-xs text-gray-600 mt-1 leading-relaxed">{s.description}</p>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          {s.amount && (
                            <div className="flex items-center gap-1 text-xs font-bold" style={{ color: '#4ECDC4' }}>
                              <TrendingUp size={11} /> {s.amount}
                            </div>
                          )}
                          {s.deadline && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Clock size={11} /> Deadline: {new Date(s.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                          )}
                        </div>
                        {s.eligibilityGrades?.length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {s.eligibilityGrades.map(g => (
                              <Badge key={g} variant="outline" className="text-[10px] px-1.5 py-0">{g}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {s.applyUrl && (
                      <div className="mt-3 flex justify-end">
                        <a href={s.applyUrl} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="text-xs gap-1"
                            style={{ borderColor: '#0B3C5D', color: '#0B3C5D' }}>
                            Apply Now <ArrowUpRight size={11} />
                          </Button>
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── WELLNESS CHECK-IN DIALOG ─── */}
      <Dialog open={checkinOpen} onOpenChange={setCheckinOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Daily Wellness Check-in</DialogTitle>
            <DialogDescription>How is {child.name} doing today?</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Mood</label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {MOOD_OPTIONS.map(m => (
                  <button key={m.value} onClick={() => setCheckinMood(m.value)}
                    className="rounded-lg p-2 text-xs text-center border-2 transition-all"
                    style={{ borderColor: checkinMood === m.value ? m.color : 'transparent', background: checkinMood === m.value ? `${m.color}15` : '#f9fafb' }}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            {[
              { label: 'Stress Level', key: 'stress', value: checkinStress, set: setCheckinStress, max: 10, low: 'Low', high: 'High', color: checkinStress <= 4 ? '#4ECDC4' : checkinStress <= 6 ? '#f59e0b' : '#ef4444' },
              { label: 'Energy', key: 'energy', value: checkinEnergy, set: setCheckinEnergy, max: 10, low: 'Low', high: 'High', color: '#0B3C5D' },
              { label: 'Focus', key: 'focus', value: checkinFocus, set: setCheckinFocus, max: 10, low: 'Distracted', high: 'Focused', color: '#0B3C5D' },
            ].map(s => (
              <div key={s.key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">{s.label}</label>
                  <span className="text-sm font-black" style={{ color: s.color }}>{s.value}/10</span>
                </div>
                <input type="range" min="1" max="10" value={s.value} onChange={e => s.set(parseInt(e.target.value))}
                  className="w-full" style={{ accentColor: s.color }} />
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>{s.low}</span><span>{s.high}</span>
                </div>
              </div>
            ))}
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Sleep Last Night (hours)</label>
              <input type="number" min="0" max="12" step="0.5" value={checkinSleep}
                onChange={e => setCheckinSleep(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="e.g. 7.5" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Notes (optional)</label>
              <Textarea value={checkinNotes} onChange={e => setCheckinNotes(e.target.value)}
                placeholder={`Any observations about ${child.name}'s day…`}
                className="mt-1 text-sm resize-none" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckinOpen(false)}>Cancel</Button>
            <Button onClick={submitCheckin} disabled={submittingCheckin}
              style={{ background: '#0B3C5D', color: 'white', border: 'none' }}>
              {submittingCheckin ? 'Saving…' : 'Save Check-in'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── UPGRADE DIALOG ─── */}
      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award size={18} style={{ color: '#0B3C5D' }} /> Upgrade Your Plan
            </DialogTitle>
            <DialogDescription>Unlock more intelligence for {child.name}'s journey</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {[
              { id: 'family', name: 'Family', price: '₹1,999/mo', color: '#0B3C5D', features: ['Up to 3 children', 'Career Compass™', 'Study Plans', 'Stress Alerts', 'Peer Benchmarking'] },
              { id: 'premium', name: 'Premium', price: '₹3,999/mo', color: '#d97706', features: ['Unlimited children', 'Mentor Access', 'Tutor Matching', 'Annual Portfolio', 'Parent Coaching'] },
            ].map(p => (
              <div key={p.id} onClick={() => setSelectedUpgradePlan(p.id)}
                className="rounded-xl border-2 p-4 cursor-pointer transition-all"
                style={{ borderColor: selectedUpgradePlan === p.id ? p.color : 'rgba(0,0,0,0.1)', background: selectedUpgradePlan === p.id ? `${p.color}08` : 'white' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold" style={{ color: p.color }}>{p.name}</span>
                  <span className="text-sm font-black text-gray-700">{p.price}</span>
                </div>
                <ul className="space-y-1">
                  {p.features.map(f => (
                    <li key={f} className="text-xs text-gray-600 flex items-center gap-1.5">
                      <Check size={11} style={{ color: p.color }} />{f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpgradeOpen(false)}>Cancel</Button>
            <Button onClick={handleUpgrade}
              style={{ background: '#0B3C5D', color: 'white', border: 'none' }}>
              Upgrade to {selectedUpgradePlan.charAt(0).toUpperCase() + selectedUpgradePlan.slice(1)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
