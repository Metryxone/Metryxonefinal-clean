import { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Screen } from '../App';
import {
  Zap, Coins, Flame, Trophy, Star, CheckCircle, Circle,
  Gift, TrendingUp, Award, ChevronRight, Loader2,
  BookOpen, Video, PenLine, FileText, Lock, ShoppingBag,
  Target, Sparkles, Brain, Clock, Users, Shield,
  MessageSquare, Heart, Monitor, Handshake, Lightbulb,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

const BRAND = { primary: '#344E86', accent: '#4ECDC4' };
const API = '/api/gamification';
const TOKEN_KEY = 'metryx_token';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface GamificationProfile {
  xp: number;
  coins: number;
  level: number;
  streakDays: number;
  missionsCompleted: number;
  xpInLevel: number;
  xpNeeded: number;
  levelProgress: number;
  canClaimLoginReward: boolean;
}

interface Mission {
  sm_id: number;
  mission_id: number;
  status: 'pending' | 'completed' | 'skipped';
  completed_at: string | null;
  title: string;
  description: string;
  type: 'quiz' | 'video' | 'assignment' | 'reading';
  difficulty: 'easy' | 'medium' | 'hard';
  xp_reward: number;
  coin_reward: number;
  skill_tag: string | null;
}

interface LeaderboardEntry {
  user_id: string;
  xp: number;
  level: number;
  streak_days: number;
  name: string | null;
  role: string;
}

interface Reward {
  id: number;
  name: string;
  description: string;
  type: 'digital' | 'academic' | 'career' | 'physical';
  coin_cost: number;
  stock: number | null;
  image_url: string | null;
}

interface Skill {
  id: number;
  name: string;
  category: string;
  description: string;
  icon: string;
  mastery_level: number;
}

type Tab = 'dashboard' | 'missions' | 'skills' | 'rewards' | 'leaderboard';

const MISSION_TYPE_ICON: Record<string, React.ElementType> = {
  quiz: Brain,
  video: Video,
  assignment: PenLine,
  reading: BookOpen,
};

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: '#4ECDC4',
  medium: '#f59e0b',
  hard: '#ef4444',
};

const REWARD_TYPE_COLOR: Record<string, string> = {
  digital: '#8b5cf6',
  academic: BRAND.primary,
  career: '#059669',
  physical: '#f97316',
};

const SKILL_ICON_MAP: Record<string, React.ElementType> = {
  Brain, MessageSquare, Lightbulb, Heart, Clock, Users, Monitor, Sparkles, Shield, Handshake, Zap,
};

interface GamificationPageProps {
  onNavigate: (screen: Screen | string, data?: Record<string, unknown>) => void;
}

export default function GamificationPage({ onNavigate }: GamificationPageProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [profile, setProfile] = useState<GamificationProfile | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingReward, setClaimingReward] = useState(false);
  const [completingMission, setCompletingMission] = useState<number | null>(null);
  const [rewardTypeFilter, setRewardTypeFilter] = useState<string>('all');

  const isLoggedIn = !!localStorage.getItem(TOKEN_KEY);

  const fetchProfile = useCallback(async () => {
    if (!isLoggedIn) return;
    const res = await fetch(`${API}/profile`, { headers: authHeaders() });
    if (res.ok) setProfile(await res.json());
  }, [isLoggedIn]);

  const fetchMissions = useCallback(async () => {
    if (!isLoggedIn) return;
    const res = await fetch(`${API}/missions/daily`, { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      setMissions(data.missions ?? []);
    }
  }, [isLoggedIn]);

  const fetchLeaderboard = useCallback(async () => {
    const res = await fetch(`${API}/leaderboard?limit=10`, { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      setLeaderboard(data.leaderboard ?? []);
      setMyRank(data.myRank ?? null);
    }
  }, []);

  const fetchRewards = useCallback(async () => {
    const res = await fetch(`${API}/rewards`, { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      setRewards(data.rewards ?? []);
    }
  }, []);

  const fetchSkills = useCallback(async () => {
    if (!isLoggedIn) return;
    const res = await fetch(`${API}/skills`, { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      setSkills(data.skills ?? []);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchProfile(), fetchMissions(), fetchLeaderboard(), fetchRewards(), fetchSkills()])
      .finally(() => setLoading(false));
  }, [fetchProfile, fetchMissions, fetchLeaderboard, fetchRewards, fetchSkills]);

  const claimLoginReward = async () => {
    if (!isLoggedIn || claimingReward) return;
    setClaimingReward(true);
    try {
      const res = await fetch(`${API}/login-reward`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Login Reward Claimed!', description: data.message });
        fetchProfile();
      } else if (data.error === 'ALREADY_CLAIMED') {
        toast({ title: 'Already claimed', description: 'Come back tomorrow for your next reward!', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Could not claim reward', variant: 'destructive' });
    } finally {
      setClaimingReward(false);
    }
  };

  const completeMission = async (smId: number) => {
    if (!isLoggedIn || completingMission !== null) return;
    setCompletingMission(smId);
    try {
      const res = await fetch(`${API}/missions/${smId}/complete`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Mission Complete!', description: data.message });
        fetchMissions();
        fetchProfile();
      } else if (data.error === 'ALREADY_COMPLETED') {
        toast({ title: 'Already done', description: 'This mission is already completed.' });
      }
    } catch {
      toast({ title: 'Error', description: 'Could not complete mission', variant: 'destructive' });
    } finally {
      setCompletingMission(null);
    }
  };

  const redeemReward = async (rewardId: number) => {
    if (!isLoggedIn) {
      toast({ title: 'Sign in required', description: 'Please log in to redeem rewards.', variant: 'destructive' });
      return;
    }
    try {
      const res = await fetch(`${API}/rewards/${rewardId}/redeem`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Reward Redeemed!', description: data.message });
        fetchProfile();
        fetchRewards();
      } else if (data.error === 'INSUFFICIENT_COINS') {
        toast({ title: 'Not enough coins', description: `You need ${data.required} coins but have ${data.available}.`, variant: 'destructive' });
      } else if (data.error === 'OUT_OF_STOCK') {
        toast({ title: 'Out of stock', description: 'This reward is no longer available.', variant: 'destructive' });
      } else if (data.error === 'ADDRESS_REQUIRED') {
        toast({ title: 'Address required', description: 'Physical rewards require a delivery address. Contact support.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Could not redeem reward', variant: 'destructive' });
    }
  };

  const filteredRewards = rewardTypeFilter === 'all'
    ? rewards
    : rewards.filter((r) => r.type === rewardTypeFilter);

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: TrendingUp },
    { key: 'missions', label: 'Missions', icon: Target },
    { key: 'skills', label: 'Skills', icon: Sparkles },
    { key: 'rewards', label: 'Rewards', icon: Gift },
    { key: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar onNavigate={onNavigate} />

      {/* Hero / Profile Strip */}
      <div style={{ background: `#1e3a6e` }} className="text-white pt-10 pb-6">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Zap className="w-7 h-7" style={{ color: BRAND.accent }} />
                Gamification Hub
              </h1>
              <p className="text-blue-200 text-sm mt-1">Earn XP, complete missions, unlock rewards</p>
            </div>
            {isLoggedIn && profile && (
              <div className="flex flex-wrap gap-4">
                <StatPill icon={<Zap className="w-4 h-4" />} label={`${profile.xp} XP`} sub={`Level ${profile.level}`} color={BRAND.accent} />
                <StatPill icon={<Coins className="w-4 h-4" />} label={`${profile.coins} Coins`} sub="spendable" color="#f59e0b" />
                <StatPill icon={<Flame className="w-4 h-4" />} label={`${profile.streakDays} days`} sub="streak" color="#f97316" />
                <StatPill icon={<CheckCircle className="w-4 h-4" />} label={`${profile.missionsCompleted}`} sub="missions done" color="#4ade80" />
              </div>
            )}
            {!isLoggedIn && (
              <Button
                onClick={() => onNavigate('login')}
                className="text-white border-white border"
                variant="outline"
                style={{ borderColor: 'rgba(255,255,255,0.5)' }}
              >
                Sign in to play
              </Button>
            )}
          </div>

          {/* XP progress bar */}
          {isLoggedIn && profile && (
            <div className="mt-4 max-w-md">
              <div className="flex justify-between text-xs text-blue-200 mb-1">
                <span>Level {profile.level}</span>
                <span>{profile.xpInLevel} / {profile.xpNeeded} XP to next level</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${profile.levelProgress}%`, background: BRAND.accent }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  tab === key
                    ? 'border-[#344E86] text-[#344E86]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-[#344E86]" />
          </div>
        ) : (
          <>
            {/* ── DASHBOARD TAB ── */}
            {tab === 'dashboard' && (
              <div className="space-y-6">
                {/* Login Reward Card */}
                {isLoggedIn && profile && (
                  <div className="rounded-2xl p-5 flex items-center justify-between gap-4"
                    style={{ background: '#4ECDC4' }}>
                    <div className="text-white">
                      <div className="font-bold text-lg flex items-center gap-2">
                        <Gift className="w-5 h-5" /> Daily Login Reward
                      </div>
                      <p className="text-sm opacity-90 mt-1">
                        {profile.canClaimLoginReward
                          ? `Claim today's reward! Streak: ${profile.streakDays} days`
                          : "You've claimed today's reward. Come back tomorrow!"}
                      </p>
                    </div>
                    <Button
                      onClick={claimLoginReward}
                      disabled={!profile.canClaimLoginReward || claimingReward}
                      className="bg-white text-teal-700 hover:bg-teal-50 font-semibold shrink-0"
                    >
                      {claimingReward ? <Loader2 className="w-4 h-4 animate-spin" /> : profile.canClaimLoginReward ? 'Claim Now' : 'Claimed ✓'}
                    </Button>
                  </div>
                )}

                {!isLoggedIn && (
                  <div className="bg-[#344E86]/5 border border-[#344E86]/20 rounded-2xl p-8 text-center">
                    <Lock className="w-10 h-10 mx-auto mb-3 text-[#344E86]/50" />
                    <h3 className="font-semibold text-gray-700 mb-1">Sign in to unlock gamification</h3>
                    <p className="text-sm text-gray-500 mb-4">Earn XP, coins, complete missions and climb the leaderboard</p>
                    <Button onClick={() => onNavigate('login')} style={{ background: BRAND.primary }}>
                      Sign In
                    </Button>
                  </div>
                )}

                {/* Quick stats grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <QuickStatCard icon={<Zap />} label="Total XP" value={profile?.xp ?? '—'} color={BRAND.accent} />
                  <QuickStatCard icon={<Coins />} label="Coins" value={profile?.coins ?? '—'} color="#f59e0b" />
                  <QuickStatCard icon={<Flame />} label="Streak" value={profile ? `${profile.streakDays}d` : '—'} color="#f97316" />
                  <QuickStatCard icon={<Trophy />} label="Level" value={profile?.level ?? '—'} color={BRAND.primary} />
                </div>

                {/* Today's missions preview */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                      <Target className="w-5 h-5" style={{ color: BRAND.primary }} />
                      Today&rsquo;s Missions
                    </h2>
                    <button onClick={() => setTab('missions')} className="text-sm font-medium flex items-center gap-1" style={{ color: BRAND.primary }}>
                      View all <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  {missions.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4 text-center">Sign in to view your daily missions</p>
                  ) : (
                    <div className="space-y-3">
                      {missions.slice(0, 3).map((m) => (
                        <MissionCard key={m.sm_id} mission={m} onComplete={completeMission} completing={completingMission === m.sm_id} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Leaderboard preview */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-amber-500" /> Top Learners
                    </h2>
                    <button onClick={() => setTab('leaderboard')} className="text-sm font-medium flex items-center gap-1" style={{ color: BRAND.primary }}>
                      Full board <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {leaderboard.slice(0, 5).map((entry, i) => (
                      <LeaderboardRow key={entry.user_id} entry={entry} rank={i + 1} />
                    ))}
                    {leaderboard.length === 0 && (
                      <p className="text-sm text-gray-400 py-4 text-center">No entries yet — be the first!</p>
                    )}
                  </div>
                  {myRank && (
                    <p className="text-xs text-center mt-3 text-gray-500">
                      Your rank: <span className="font-semibold" style={{ color: BRAND.primary }}>#{myRank}</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── MISSIONS TAB ── */}
            {tab === 'missions' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-800">
                    Daily Missions &mdash; {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </h2>
                  <Badge style={{ background: `${BRAND.accent}22`, color: BRAND.accent }} className="text-xs font-semibold">
                    {missions.filter((m) => m.status === 'completed').length}/{missions.length} done
                  </Badge>
                </div>

                {!isLoggedIn ? (
                  <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
                    <Lock className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500">Sign in to access daily missions</p>
                    <Button className="mt-4" style={{ background: BRAND.primary }} onClick={() => onNavigate('login')}>Sign In</Button>
                  </div>
                ) : missions.length === 0 ? (
                  <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
                    <Target className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500">No missions assigned yet. Check back soon!</p>
                    <Button className="mt-4" style={{ background: BRAND.primary }} onClick={() => { fetchMissions(); fetchProfile(); }}>
                      Refresh Missions
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {missions.map((m) => (
                      <MissionCard key={m.sm_id} mission={m} onComplete={completeMission} completing={completingMission === m.sm_id} expanded />
                    ))}
                  </div>
                )}

                {/* Mission reward legend */}
                <div className="bg-[#344E86]/5 rounded-2xl p-4 text-sm text-gray-600">
                  <p className="font-semibold mb-2 text-gray-700">How missions work</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Complete 3 missions daily to maintain your streak</li>
                    <li>Each mission awards XP (experience) and Coins</li>
                    <li>Coins can be spent in the Reward Store</li>
                    <li>100 Coins = &#8377;10 equivalent &middot; Monthly cap: 1,200 coins</li>
                  </ul>
                </div>
              </div>
            )}

            {/* ── SKILLS TAB ── */}
            {tab === 'skills' && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-gray-800">Skill Graph</h2>
                {!isLoggedIn ? (
                  <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
                    <Lock className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500">Sign in to view your skill profile</p>
                    <Button className="mt-4" style={{ background: BRAND.primary }} onClick={() => onNavigate('login')}>Sign In</Button>
                  </div>
                ) : (
                  <>
                    {/* Group by category */}
                    {Object.entries(
                      skills.reduce<Record<string, Skill[]>>((acc, s) => {
                        (acc[s.category] ??= []).push(s);
                        return acc;
                      }, {}),
                    ).map(([category, catSkills]) => (
                      <div key={category} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                        <h3 className="font-semibold text-gray-700 mb-4">{category}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {catSkills.map((skill) => {
                            const IconComp = SKILL_ICON_MAP[skill.icon] ?? Zap;
                            return (
                              <div key={skill.id} className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                  style={{ background: `${BRAND.primary}15` }}>
                                  <IconComp className="w-4 h-4" style={{ color: BRAND.primary }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium text-gray-700 truncate">{skill.name}</span>
                                    <span className="text-xs font-bold ml-2" style={{ color: BRAND.primary }}>{skill.mastery_level}%</span>
                                  </div>
                                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full transition-all duration-700"
                                      style={{
                                        width: `${skill.mastery_level}%`,
                                        background: skill.mastery_level >= 70 ? BRAND.accent : skill.mastery_level >= 40 ? '#f59e0b' : '#e5e7eb',
                                      }}
                                    />
                                  </div>
                                  <p className="text-xs text-gray-400 mt-1 truncate">{skill.description}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {skills.length === 0 && (
                      <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
                        <Sparkles className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                        <p className="text-gray-500">Complete missions to grow your skills</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── REWARDS TAB ── */}
            {tab === 'rewards' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5" style={{ color: BRAND.primary }} />
                    Reward Store
                  </h2>
                  {isLoggedIn && profile && (
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
                      <Coins className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-semibold text-amber-700">{profile.coins} coins available</span>
                    </div>
                  )}
                </div>

                {/* Filter tabs */}
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {['all', 'digital', 'academic', 'career', 'physical'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setRewardTypeFilter(t)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                        rewardTypeFilter === t ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      style={rewardTypeFilter === t ? { background: BRAND.primary } : {}}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredRewards.map((reward) => (
                    <RewardCard
                      key={reward.id}
                      reward={reward}
                      userCoins={profile?.coins ?? 0}
                      isLoggedIn={isLoggedIn}
                      onRedeem={() => redeemReward(reward.id)}
                    />
                  ))}
                  {filteredRewards.length === 0 && (
                    <div className="col-span-full bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
                      <Gift className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                      <p className="text-gray-500">No rewards in this category yet</p>
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 text-xs text-gray-500 border border-gray-100">
                  <strong className="text-gray-600">Coin Economy:</strong> 100 coins = &#8377;10 value &middot; Monthly spend cap: 1,200 coins &middot;
                  Coins expire 90 days after earning &middot; Earn:spend ratio 3:1
                </div>
              </div>
            )}

            {/* ── LEADERBOARD TAB ── */}
            {tab === 'leaderboard' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-500" /> XP Leaderboard
                  </h2>
                  {myRank && (
                    <Badge style={{ background: `${BRAND.primary}15`, color: BRAND.primary }} className="font-semibold">
                      Your rank: #{myRank}
                    </Badge>
                  )}
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  {leaderboard.length === 0 ? (
                    <div className="p-10 text-center">
                      <Trophy className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                      <p className="text-gray-500">No one on the board yet. Complete missions to earn XP!</p>
                    </div>
                  ) : (
                    <div>
                      {leaderboard.map((entry, i) => (
                        <LeaderboardRow key={entry.user_id} entry={entry} rank={i + 1} large />
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-[#344E86]/5 rounded-2xl p-4 text-sm text-gray-600">
                  <p className="font-semibold mb-2 text-gray-700">How to climb the leaderboard</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Complete daily missions for XP</li>
                    <li>Maintain login streaks for bonus rewards</li>
                    <li>Harder missions award more XP</li>
                    <li>Rankings update in real time</li>
                  </ul>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatPill({ icon, label, sub, color }: { icon: React.ReactNode; label: string | number; sub: string; color: string }) {
  return (
    <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
      <span style={{ color }}>{icon}</span>
      <div>
        <div className="text-sm font-bold">{label}</div>
        <div className="text-xs opacity-70">{sub}</div>
      </div>
    </div>
  );
}

function QuickStatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <div className="text-xl font-bold text-gray-800">{value}</div>
        <div className="text-xs text-gray-400">{label}</div>
      </div>
    </div>
  );
}

function MissionCard({
  mission, onComplete, completing, expanded = false,
}: {
  mission: Mission; onComplete: (id: number) => void; completing: boolean; expanded?: boolean;
}) {
  const Icon = MISSION_TYPE_ICON[mission.type] ?? FileText;
  const done = mission.status === 'completed';
  return (
    <div className={`bg-white rounded-xl p-4 border transition-all ${done ? 'border-teal-100 bg-teal-50/30' : 'border-gray-100'}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${done ? 'bg-teal-100' : 'bg-gray-100'}`}>
          {done ? <CheckCircle className="w-5 h-5 text-teal-500" /> : <Icon className="w-5 h-5 text-gray-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={`text-sm font-semibold ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{mission.title}</p>
              {expanded && mission.description && (
                <p className="text-xs text-gray-400 mt-0.5">{mission.description}</p>
              )}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${DIFFICULTY_COLOR[mission.difficulty]}20`, color: DIFFICULTY_COLOR[mission.difficulty] }}>
                  {mission.difficulty}
                </span>
                <span className="text-xs text-gray-400 flex items-center gap-1"><Zap className="w-3 h-3" />{mission.xp_reward} XP</span>
                <span className="text-xs text-gray-400 flex items-center gap-1"><Coins className="w-3 h-3" />{mission.coin_reward} coins</span>
                {mission.skill_tag && <span className="text-xs text-gray-400">{mission.skill_tag}</span>}
              </div>
            </div>
            {!done && (
              <Button
                size="sm"
                onClick={() => onComplete(mission.sm_id)}
                disabled={completing}
                className="text-white shrink-0 text-xs"
                style={{ background: BRAND.primary }}
              >
                {completing ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Circle className="w-3 h-3 mr-1" />Done</>}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LeaderboardRow({ entry, rank, large = false }: { entry: LeaderboardEntry; rank: number; large?: boolean }) {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
  return (
    <div className={`flex items-center gap-3 px-4 ${large ? 'py-4 border-b last:border-0' : 'py-2'}`}>
      <span className={`w-7 text-center font-bold text-sm ${rank <= 3 ? 'text-amber-500' : 'text-gray-400'}`}>
        {medal ?? `#${rank}`}
      </span>
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
        style={{ background: BRAND.primary }}>
        {(entry.name ?? 'U').charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{entry.name ?? 'Anonymous'}</p>
        {large && <p className="text-xs text-gray-400">Level {entry.level} &middot; {entry.streak_days}d streak</p>}
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold" style={{ color: BRAND.primary }}>{entry.xp} XP</p>
        {large && <p className="text-xs text-gray-400">Lvl {entry.level}</p>}
      </div>
    </div>
  );
}

function RewardCard({
  reward, userCoins, isLoggedIn, onRedeem,
}: {
  reward: Reward; userCoins: number; isLoggedIn: boolean; onRedeem: () => void;
}) {
  const canAfford = isLoggedIn && userCoins >= reward.coin_cost;
  const typeColor = REWARD_TYPE_COLOR[reward.type] ?? BRAND.primary;
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-semibold px-2 py-1 rounded-full capitalize"
          style={{ background: `${typeColor}15`, color: typeColor }}>
          {reward.type}
        </span>
        {reward.stock !== null && (
          <span className="text-xs text-gray-400">{reward.stock} left</span>
        )}
      </div>
      <h3 className="text-sm font-semibold text-gray-800 mb-1">{reward.name}</h3>
      {reward.description && (
        <p className="text-xs text-gray-400 mb-3 flex-1">{reward.description}</p>
      )}
      <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-50">
        <div className="flex items-center gap-1 font-bold text-amber-600">
          <Coins className="w-4 h-4" />
          <span>{reward.coin_cost}</span>
        </div>
        <Button
          size="sm"
          onClick={onRedeem}
          disabled={!canAfford}
          className="text-xs font-semibold text-white"
          style={canAfford ? { background: BRAND.primary } : {}}
        >
          {!isLoggedIn ? 'Sign in' : !canAfford ? <><Lock className="w-3 h-3 mr-1" />Need more</> : 'Redeem'}
        </Button>
      </div>
    </div>
  );
}
