import { BRAND } from '@/design-system/tokens';
import { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import type { Screen } from '../../App';
import {
  Brain, Target, BookOpen, Users, Star, Award, BarChart3, TrendingUp,
  CheckCircle, Clock, ChevronRight, Sparkles, Zap, Trophy,
  Briefcase, ArrowRight, RefreshCw, GraduationCap, Lightbulb,
  Activity, FileText, Compass, MessageSquare, Bell, PieChart, LogOut,
  AlertCircle, Heart, DollarSign, CalendarCheck, Calendar, Video,
  Edit3, Settings, MapPin, Globe2, ThumbsUp, UserCheck, Flame,
  TrendingDown, Minus, BookMarked, Phone, Mail, Shield, Eye, Plus
} from 'lucide-react';



type Tab = 'dashboard' | 'mentees' | 'sessions' | 'earnings' | 'profile';

interface MentorCareerPageProps {
  onNavigate: (screen: Screen | string) => void;
}

const MENTEES = [
  { id: 'm1', name: 'Aanya Sharma', grade: 'Grade 10', career: 'Software Engineering', readiness: 68, sessions: 4, nextSession: 'Apr 1', avatar: '👩‍🎓' },
  { id: 'm2', name: 'Rohan Kapoor', grade: 'Grade 12', career: 'Data Science', readiness: 74, sessions: 6, nextSession: 'Apr 3', avatar: '👨‍💻' },
  { id: 'm3', name: 'Diya Patel', grade: 'B.Tech 3rd Yr', career: 'Product Management', readiness: 61, sessions: 3, nextSession: 'Apr 5', avatar: '👩‍💼' },
  { id: 'm4', name: 'Ishaan Mehta', grade: 'MBA 1st Yr', career: 'Consulting', readiness: 79, sessions: 8, nextSession: 'Apr 7', avatar: '👨‍🎓' },
];

const MY_SESSIONS = [
  { mentee: 'Aanya Sharma', topic: 'Career Roadmap Planning', date: 'Apr 1, 4:00 PM', mode: 'Online', status: 'upcoming', duration: 60 },
  { mentee: 'Rohan Kapoor', topic: 'Data Science Interview Prep', date: 'Apr 3, 5:30 PM', mode: 'Online', status: 'upcoming', duration: 45 },
  { mentee: 'Diya Patel', topic: 'Product Thinking Frameworks', date: 'Mar 28, 4:00 PM', mode: 'Online', status: 'completed', duration: 60, rating: 5 },
  { mentee: 'Ishaan Mehta', topic: 'Case Interview Strategy', date: 'Mar 25, 3:00 PM', mode: 'Online', status: 'completed', duration: 90, rating: 5 },
  { mentee: 'Aanya Sharma', topic: 'Resume Review', date: 'Mar 20, 4:30 PM', mode: 'Online', status: 'completed', duration: 30, rating: 4 },
];

const EARNINGS = [
  { month: 'Oct', amount: 14000 },
  { month: 'Nov', amount: 18500 },
  { month: 'Dec', amount: 21000 },
  { month: 'Jan', amount: 22000 },
  { month: 'Feb', amount: 19200 },
  { month: 'Mar', amount: 24500 },
];

const IMPACT_METRICS = [
  { label: 'Students Impacted', val: '48', color: BRAND.primary, icon: <Users size={16} /> },
  { label: 'Avg Readiness Lift', val: '+18%', color: BRAND.green, icon: <TrendingUp size={16} /> },
  { label: 'Sessions Completed', val: '124', color: BRAND.accent, icon: <CalendarCheck size={16} /> },
  { label: 'Avg Rating', val: '4.9 ★', color: BRAND.orange, icon: <Star size={16} /> },
];

const REVIEWS = [
  { mentee: 'Rohan Kapoor', rating: 5, comment: 'Transformed my understanding of data science careers. Highly specific and actionable guidance.', date: 'Mar 28' },
  { mentee: 'Ishaan Mehta', rating: 5, comment: 'Best mentor I have had. Case interview prep was exactly what I needed for BCG.', date: 'Mar 25' },
  { mentee: 'Diya Patel', rating: 5, comment: 'Very patient and knowledgeable. Made complex product frameworks easy to understand.', date: 'Mar 18' },
];

function MiniBar({ month, amount, max }: { month: string; amount: number; max: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[9px] font-medium" style={{ color: BRAND.primary }}>₹{(amount / 1000).toFixed(0)}K</span>
      <div className="w-8 rounded-t-md" style={{ height: `${(amount / max) * 60}px`, backgroundColor: BRAND.primary }} />
      <span className="text-[9px] text-gray-400">{month}</span>
    </div>
  );
}

export default function MentorCareerPage({ onNavigate }: MentorCareerPageProps) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const raw = localStorage.getItem('metryx_user');
    if (raw) try { setUser(JSON.parse(raw)); } catch {}
  }, []);

  const mentorName = (user?.name || user?.username || 'Mentor').split(' ')[0];
  const thisMonthEarnings = EARNINGS[EARNINGS.length - 1].amount;
  const maxEarnings = Math.max(...EARNINGS.map(e => e.amount));

  const NAV: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 size={16} /> },
    { id: 'mentees', label: 'My Mentees', icon: <Users size={16} /> },
    { id: 'sessions', label: 'Sessions', icon: <CalendarCheck size={16} /> },
    { id: 'earnings', label: 'Earnings', icon: <DollarSign size={16} /> },
    { id: 'profile', label: 'My Profile', icon: <UserCheck size={16} /> },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8fafc' }}>
      <Navbar onNavigate={onNavigate} currentScreen="mentor-career-portal" />
      <div className="flex gap-0 max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-10 min-h-[calc(100vh-80px)]">

        {/* Sidebar */}
        <aside className="w-60 shrink-0 mr-6 space-y-1 pt-4">
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: BRAND.primary }}>
                {mentorName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-xs font-bold text-gray-800">{mentorName}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[9px] text-amber-500">★★★★★</span>
                  <span className="text-[9px] text-gray-400">4.9</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-50">
              <div>
                <div className="text-base font-bold" style={{ color: BRAND.primary }}>{MENTEES.length}</div>
                <div className="text-[9px] text-gray-400">Active Mentees</div>
              </div>
              <div>
                <div className="text-base font-bold" style={{ color: BRAND.green }}>₹{(thisMonthEarnings / 1000).toFixed(1)}K</div>
                <div className="text-[9px] text-gray-400">This Month</div>
              </div>
            </div>
          </div>

          {NAV.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-left ${tab === n.id ? 'text-white shadow-sm' : 'text-gray-600 hover:bg-white hover:shadow-sm'}`}
              style={tab === n.id ? { backgroundColor: BRAND.primary } : {}}>
              {n.icon} {n.label}
            </button>
          ))}

          <div className="pt-3 mt-3 border-t border-gray-100 space-y-1">
            <button onClick={() => onNavigate('mentor-marketplace')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-500 hover:bg-white hover:text-gray-700 transition-all">
              <Globe2 size={14} /> My Public Profile
            </button>
            <button onClick={() => onNavigate('mentor-dashboard')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-500 hover:bg-white hover:text-gray-700 transition-all">
              <LogOut size={14} /> Mentor Dashboard
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 pt-4 space-y-5">

          {/* ── DASHBOARD ── */}
          {tab === 'dashboard' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Welcome back, {mentorName} 👋</h1>
                <p className="text-xs text-gray-500 mt-0.5">Your mentorship impact dashboard · Career Seeker Portal</p>
              </div>

              {/* Impact KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {IMPACT_METRICS.map(k => (
                  <div key={k.label} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span style={{ color: k.color }}>{k.icon}</span>
                    </div>
                    <div className="text-xl font-bold" style={{ color: k.color }}>{k.val}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{k.label}</div>
                  </div>
                ))}
              </div>

              {/* Upcoming sessions + earnings preview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                      <Clock size={13} style={{ color: BRAND.accent }} /> Upcoming Sessions
                    </h3>
                    <button onClick={() => setTab('sessions')} className="text-[10px] font-medium" style={{ color: BRAND.primary }}>
                      View all →
                    </button>
                  </div>
                  <div className="space-y-3">
                    {MY_SESSIONS.filter(s => s.status === 'upcoming').map((s, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: BRAND.primary }}>
                          {s.mentee.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <div className="text-xs font-semibold text-gray-800">{s.mentee}</div>
                          <div className="text-[10px] text-gray-400">{s.topic}</div>
                          <div className="text-[9px] text-gray-400 mt-0.5">{s.date} · {s.mode} · {s.duration}min</div>
                        </div>
                        <button className="text-[10px] px-2.5 py-1 rounded-lg font-semibold text-white shrink-0" style={{ backgroundColor: BRAND.accent }}>
                          Join
                        </button>
                      </div>
                    ))}
                    {MY_SESSIONS.filter(s => s.status === 'upcoming').length === 0 && (
                      <div className="text-center py-4 text-xs text-gray-400">No upcoming sessions</div>
                    )}
                  </div>
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <h3 className="text-xs font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <DollarSign size={13} style={{ color: BRAND.green }} /> Earnings (6mo)
                  </h3>
                  <div className="flex items-end justify-between gap-1 h-20 mb-2">
                    {EARNINGS.map(e => <MiniBar key={e.month} month={e.month} amount={e.amount} max={maxEarnings} />)}
                  </div>
                  <div className="pt-3 border-t border-gray-50">
                    <div className="text-base font-bold" style={{ color: BRAND.green }}>₹{(thisMonthEarnings / 1000).toFixed(1)}K</div>
                    <div className="text-[9px] text-gray-400">This month's earnings</div>
                  </div>
                </div>
              </div>

              {/* Mentee readiness overview */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                    <Users size={13} style={{ color: BRAND.primary }} /> Mentee Career Readiness
                  </h3>
                  <button onClick={() => setTab('mentees')} className="text-[10px] font-medium" style={{ color: BRAND.primary }}>
                    View all →
                  </button>
                </div>
                <div className="space-y-2.5">
                  {MENTEES.map(m => (
                    <div key={m.id} className="flex items-center gap-3">
                      <span className="text-xl shrink-0">{m.avatar}</span>
                      <div className="min-w-0 w-36">
                        <div className="text-xs font-medium text-gray-800 truncate">{m.name}</div>
                        <div className="text-[9px] text-gray-400 truncate">{m.career}</div>
                      </div>
                      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${m.readiness}%`, backgroundColor: m.readiness >= 70 ? BRAND.green : BRAND.accent }} />
                      </div>
                      <span className="text-xs font-bold shrink-0 w-8 text-right" style={{ color: m.readiness >= 70 ? BRAND.green : BRAND.accent }}>{m.readiness}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent reviews */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <h3 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Star size={13} style={{ color: BRAND.orange }} /> Recent Reviews
                </h3>
                <div className="space-y-3">
                  {REVIEWS.slice(0, 2).map((r, i) => (
                    <div key={i} className="p-3 rounded-xl border border-gray-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-gray-800">{r.mentee}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-amber-400 text-[10px]">{'★'.repeat(r.rating)}</span>
                          <span className="text-[9px] text-gray-400">{r.date}</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-600 leading-relaxed">{r.comment}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── MENTEES ── */}
          {tab === 'mentees' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">My Mentees</h1>
                  <p className="text-xs text-gray-500 mt-0.5">Career readiness progress for all active mentees</p>
                </div>
                <button className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-white" style={{ backgroundColor: BRAND.primary }}>
                  <Plus size={13} /> Accept New Request
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {MENTEES.map(m => (
                  <div key={m.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-3xl">{m.avatar}</span>
                      <div className="flex-1">
                        <div className="text-sm font-bold text-gray-800">{m.name}</div>
                        <div className="text-[10px] text-gray-400">{m.grade} · {m.career}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold" style={{ color: m.readiness >= 70 ? BRAND.green : BRAND.accent }}>{m.readiness}%</div>
                        <div className="text-[9px] text-gray-400">readiness</div>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 mb-3 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${m.readiness}%`, backgroundColor: m.readiness >= 70 ? BRAND.green : BRAND.accent }} />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-gray-500">
                      <span>{m.sessions} sessions completed</span>
                      <span className="text-gray-400">Next: {m.nextSession}</span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button className="flex-1 text-[10px] font-medium py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                        View Progress
                      </button>
                      <button className="flex-1 text-[10px] font-medium py-1.5 rounded-lg text-white" style={{ backgroundColor: BRAND.primary }}>
                        Book Session
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SESSIONS ── */}
          {tab === 'sessions' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Session History</h1>
                <p className="text-xs text-gray-500 mt-0.5">All mentoring sessions — past and upcoming</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[{ label: 'Upcoming', val: MY_SESSIONS.filter(s => s.status === 'upcoming').length, color: BRAND.primary }, { label: 'Completed', val: MY_SESSIONS.filter(s => s.status === 'completed').length, color: BRAND.green }, { label: 'Hours Delivered', val: Math.round(MY_SESSIONS.filter(s => s.status === 'completed').reduce((a, s) => a + s.duration, 0) / 60 * 10) / 10, color: BRAND.accent }].map(k => (
                  <div key={k.label} className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
                    <div className="text-2xl font-bold" style={{ color: k.color }}>{k.val}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{k.label}</div>
                  </div>
                ))}
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className="space-y-3">
                  {MY_SESSIONS.map((s, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: s.status === 'upcoming' ? BRAND.primary : '#94a3b8' }}>
                        {s.mentee.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-gray-800">{s.mentee}</div>
                        <div className="text-[10px] text-gray-400 truncate">{s.topic}</div>
                        <div className="text-[9px] text-gray-400 mt-0.5">{s.date} · {s.mode} · {s.duration}min</div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${s.status === 'upcoming' ? 'text-blue-700 bg-blue-50' : 'text-teal-700 bg-teal-50'}`}>
                          {s.status}
                        </span>
                        {s.rating && <div className="text-[10px] text-amber-400 mt-1">{'★'.repeat(s.rating)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── EARNINGS ── */}
          {tab === 'earnings' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Earnings</h1>
                <p className="text-xs text-gray-500 mt-0.5">Revenue from mentoring sessions</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'This Month', val: `₹${(thisMonthEarnings / 1000).toFixed(1)}K`, color: BRAND.green },
                  { label: '6-Month Total', val: `₹${(EARNINGS.reduce((a, e) => a + e.amount, 0) / 1000).toFixed(0)}K`, color: BRAND.primary },
                  { label: 'Avg per Session', val: '₹1,975', color: BRAND.accent },
                ].map(k => (
                  <div key={k.label} className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
                    <div className="text-2xl font-bold" style={{ color: k.color }}>{k.val}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{k.label}</div>
                  </div>
                ))}
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-800 mb-5">Monthly Earnings</h3>
                <div className="flex items-end justify-around gap-2 h-28">
                  {EARNINGS.map(e => (
                    <div key={e.month} className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-medium" style={{ color: BRAND.primary }}>₹{(e.amount / 1000).toFixed(0)}K</span>
                      <div className="w-12 rounded-t-lg transition-all" style={{ height: `${(e.amount / maxEarnings) * 80}px`, backgroundColor: e.month === 'Mar' ? BRAND.green : BRAND.primary }} />
                      <span className="text-[10px] text-gray-400">{e.month}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <h3 className="text-xs font-semibold text-gray-700 mb-3">Pending Payouts</h3>
                <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100">
                  <div>
                    <div className="text-xs font-semibold text-gray-800">March 2026 Payout</div>
                    <div className="text-[10px] text-gray-400">12 sessions · Processing</div>
                  </div>
                  <div className="text-sm font-bold" style={{ color: BRAND.green }}>₹24,500</div>
                </div>
              </div>
            </div>
          )}

          {/* ── PROFILE ── */}
          {tab === 'profile' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-gray-900">My Mentor Profile</h1>
                <p className="text-xs text-gray-500 mt-0.5">Public profile visible to students and parents</p>
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <div className="flex items-start gap-4 mb-5">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold" style={{ backgroundColor: BRAND.primary }}>
                    {mentorName.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="text-base font-bold text-gray-800">{mentorName}</div>
                    <div className="text-xs text-gray-500">Senior Software Engineer · 8 years experience</div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-1 text-[10px] text-amber-500"><Star size={10} /> 4.9 (48 reviews)</span>
                      <span className="flex items-center gap-1 text-[10px] text-gray-400"><MapPin size={10} /> Bengaluru</span>
                      <span className="flex items-center gap-1 text-[10px] text-gray-400"><Globe2 size={10} /> English, Hindi</span>
                    </div>
                  </div>
                  <button className="flex items-center gap-1 text-[10px] font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                    <Edit3 size={11} /> Edit
                  </button>
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'Expertise', val: 'Software Engineering, Data Structures, System Design, Career Guidance' },
                    { label: 'Education', val: 'B.Tech Computer Science · IIT Bombay (2016)' },
                    { label: 'Session Rate', val: '₹1,800 – ₹2,500 / hour' },
                    { label: 'Availability', val: 'Mon–Sat, 4 PM – 8 PM IST' },
                  ].map(f => (
                    <div key={f.label} className="flex items-start gap-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 w-24 shrink-0 pt-0.5">{f.label}</span>
                      <span className="text-xs text-gray-700">{f.val}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-5">
                  <button onClick={() => onNavigate('mentor-profile')} className="flex items-center gap-1 text-xs font-medium px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">
                    <Eye size={12} /> Preview Public Profile
                  </button>
                  <button className="flex items-center gap-1 text-xs font-medium px-4 py-2 rounded-xl text-white" style={{ backgroundColor: BRAND.primary }}>
                    <Edit3 size={12} /> Update Profile
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      <Footer onNavigate={onNavigate} />
    </div>
  );
}
